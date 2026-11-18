-- =====================================================================================
-- GNOTH · GESTÃO CLÍNICA — BLINDAGEM TOTAL DE BANCO DE DADOS, RLS E ANTI-INVASÃO
-- Rode este script 1 única vez no SQL Editor do Supabase (é 100% seguro rodar de novo).
-- =====================================================================================

-- 1. GARANTIA DE COLUNAS NOVAS E OPCIONAIS (SEM PERDER NENHUM DADO EXISTENTE)
ALTER TABLE public.usuarios_perfis ADD COLUMN IF NOT EXISTS plano text DEFAULT 'trial';
ALTER TABLE public.usuarios_perfis ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;
ALTER TABLE public.usuarios_perfis ADD COLUMN IF NOT EXISTS assinatura_vence_em timestamptz;
ALTER TABLE public.usuarios_perfis ADD COLUMN IF NOT EXISTS chave_pix text;
ALTER TABLE public.usuarios_perfis ADD COLUMN IF NOT EXISTS crp text;
ALTER TABLE public.usuarios_perfis ADD COLUMN IF NOT EXISTS abordagem text;
ALTER TABLE public.usuarios_perfis ADD COLUMN IF NOT EXISTS tem_lp boolean DEFAULT false;

ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS profissional_slug text;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS excluido_em timestamptz;
ALTER TABLE public.atendimentos ADD COLUMN IF NOT EXISTS excluido_em timestamptz;
ALTER TABLE public.pagamentos ADD COLUMN IF NOT EXISTS receita_saude_emitido boolean DEFAULT false;
ALTER TABLE public.pagamentos ADD COLUMN IF NOT EXISTS excluido_em timestamptz;
ALTER TABLE public.prontuarios_historico ADD COLUMN IF NOT EXISTS excluido_em timestamptz;

-- 2. TABELA DE CONFIGURAÇÃO GLOBAL DO SISTEMA (CHAVE PIX OFICIAL DO SAAS EM QUALQUER APARELHO)
CREATE TABLE IF NOT EXISTS public.sistema_config (
    chave text PRIMARY KEY,
    valor text NOT NULL,
    updated_at timestamptz DEFAULT now()
);

-- Define a Chave Pix Aleatória Oficial do Sistema Gnoth (para assinaturas do SaaS)
INSERT INTO public.sistema_config (chave, valor)
VALUES ('pix_oficial_gnoth', 'e8636132-591c-4638-97f9-38fe82826a43')
ON CONFLICT (chave) DO UPDATE
SET valor = EXCLUDED.valor, updated_at = now();

-- 3. FUNÇÃO AUXILIAR ANTI-RECURSÃO PARA CHECAR ADMINISTRADOR
CREATE OR REPLACE FUNCTION public.eh_admin_gnoth()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.usuarios_perfis
        WHERE id = auth.uid() AND role = 'admin'
    );
$$;

-- 4. RPC PÚBLICA SEGURA PARA O LINK DA BIO (/triagem?triagem=ID)
-- Devolve APENAS nome, crp e abordagem, sem nunca expor e-mail ou chave Pix das psicólogas!
CREATE OR REPLACE FUNCTION public.obter_perfil_publico_triagem(p_id uuid)
RETURNS TABLE (nome text, crp text, abordagem text)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT up.nome, up.crp, up.abordagem
    FROM public.usuarios_perfis up
    WHERE up.id = p_id
    LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.obter_perfil_publico_triagem(uuid) TO anon, authenticated;

-- 5. TRIGGER ANTI-ESCALADA DE PRIVILÉGIO (BLOQUEIA ALTERAR ROLE / PLANO PELO DEVTOOLS F12)
CREATE OR REPLACE FUNCTION public.proteger_campos_restritos_perfil()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Se a execução vier do SQL Editor do Supabase (auth.uid() IS NULL) ou de um Admin real, permite tudo
    IF auth.uid() IS NULL OR public.eh_admin_gnoth() THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        NEW.role := 'psicologo';
        NEW.plano := 'trial';
        NEW.assinatura_vence_em := NULL;
        NEW.tem_lp := false;
        IF NEW.trial_ends_at IS NULL THEN
            NEW.trial_ends_at := now() + interval '7 days';
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW.role IS DISTINCT FROM OLD.role THEN
            RAISE EXCEPTION 'Acesso negado: apenas administradores podem alterar o nível de acesso.';
        END IF;

        -- Permite apenas inicializar trial_ends_at uma única vez se estivesse nulo em conta antiga
        IF OLD.trial_ends_at IS NULL AND COALESCE(OLD.plano, 'trial') = 'trial' AND NEW.plano = 'trial' THEN
            NEW.assinatura_vence_em := OLD.assinatura_vence_em;
            NEW.tem_lp := OLD.tem_lp;
            RETURN NEW;
        END IF;

        IF NEW.plano IS DISTINCT FROM OLD.plano
           OR NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at
           OR NEW.assinatura_vence_em IS DISTINCT FROM OLD.assinatura_vence_em
           OR NEW.tem_lp IS DISTINCT FROM OLD.tem_lp THEN
            RAISE EXCEPTION 'Acesso negado: apenas administradores podem alterar planos e vencimentos.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_campos_restritos_perfil ON public.usuarios_perfis;
CREATE TRIGGER trg_proteger_campos_restritos_perfil
BEFORE INSERT OR UPDATE ON public.usuarios_perfis
FOR EACH ROW
EXECUTE FUNCTION public.proteger_campos_restritos_perfil();

-- 6. TRIGGER AUTOMÁTICA NO SIGNUP (CRIA PERFIL + TRIAL DE 7 DIAS MESMO COM CONFIRMAÇÃO DE E-MAIL)
CREATE OR REPLACE FUNCTION public.criar_perfil_novo_usuario_gnoth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.usuarios_perfis (id, email, nome, crp, role, plano, trial_ends_at)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'nome'), ''), split_part(NEW.email, '@', 1)),
        NULLIF(trim(NEW.raw_user_meta_data->>'crp'), ''),
        'psicologo',
        'trial',
        now() + interval '7 days'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_gnoth ON auth.users;
CREATE TRIGGER on_auth_user_created_gnoth
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.criar_perfil_novo_usuario_gnoth();

-- =====================================================================================
-- 7. POLÍTICAS DE ROW LEVEL SECURITY (RLS) EM TODAS AS TABELAS
-- =====================================================================================

-- 7.1 sistema_config
ALTER TABLE public.sistema_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leem sistema_config" ON public.sistema_config;
CREATE POLICY "Autenticados leem sistema_config"
ON public.sistema_config FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Somente Admin edita sistema_config" ON public.sistema_config;
CREATE POLICY "Somente Admin edita sistema_config"
ON public.sistema_config FOR ALL
TO authenticated
USING (public.eh_admin_gnoth())
WITH CHECK (public.eh_admin_gnoth());

-- 7.2 usuarios_perfis
ALTER TABLE public.usuarios_perfis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Dono ou Admin le usuarios_perfis" ON public.usuarios_perfis;
CREATE POLICY "Dono ou Admin le usuarios_perfis"
ON public.usuarios_perfis FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.eh_admin_gnoth());

DROP POLICY IF EXISTS "Dono ou Admin insere usuarios_perfis" ON public.usuarios_perfis;
CREATE POLICY "Dono ou Admin insere usuarios_perfis"
ON public.usuarios_perfis FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid() OR public.eh_admin_gnoth());

DROP POLICY IF EXISTS "Dono ou Admin atualiza usuarios_perfis" ON public.usuarios_perfis;
CREATE POLICY "Dono ou Admin atualiza usuarios_perfis"
ON public.usuarios_perfis FOR UPDATE
TO authenticated
USING (id = auth.uid() OR public.eh_admin_gnoth())
WITH CHECK (id = auth.uid() OR public.eh_admin_gnoth());

-- 7.3 landing_pages
ALTER TABLE public.landing_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura publica landing_pages" ON public.landing_pages;
CREATE POLICY "Leitura publica landing_pages"
ON public.landing_pages FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Dono ou Admin gerencia landing_pages" ON public.landing_pages;
CREATE POLICY "Dono ou Admin gerencia landing_pages"
ON public.landing_pages FOR ALL
TO authenticated
USING (auth.uid() = user_id OR public.eh_admin_gnoth())
WITH CHECK (auth.uid() = user_id OR public.eh_admin_gnoth());

-- 7.4 pacientes (inclui envio público seguro APENAS para status = 'Novo Contato')
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Triagem publica insere apenas Novo Contato" ON public.pacientes;
CREATE POLICY "Triagem publica insere apenas Novo Contato"
ON public.pacientes FOR INSERT
TO anon, authenticated
WITH CHECK (status = 'Novo Contato');

DROP POLICY IF EXISTS "Psicologa ou Admin gerencia seus pacientes" ON public.pacientes;
CREATE POLICY "Psicologa ou Admin gerencia seus pacientes"
ON public.pacientes FOR ALL
TO authenticated
USING (psicologa_id = auth.uid() OR public.eh_admin_gnoth())
WITH CHECK (psicologa_id = auth.uid() OR public.eh_admin_gnoth());

-- 7.5 atendimentos
ALTER TABLE public.atendimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Psicologa ou Admin gerencia atendimentos" ON public.atendimentos;
CREATE POLICY "Psicologa ou Admin gerencia atendimentos"
ON public.atendimentos FOR ALL
TO authenticated
USING (
    public.eh_admin_gnoth()
    OR EXISTS (
        SELECT 1 FROM public.pacientes p
        WHERE p.id = atendimentos.paciente_id AND p.psicologa_id = auth.uid()
    )
)
WITH CHECK (
    public.eh_admin_gnoth()
    OR EXISTS (
        SELECT 1 FROM public.pacientes p
        WHERE p.id = atendimentos.paciente_id AND p.psicologa_id = auth.uid()
    )
);

-- 7.6 pagamentos
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Psicologa ou Admin gerencia pagamentos" ON public.pagamentos;
CREATE POLICY "Psicologa ou Admin gerencia pagamentos"
ON public.pagamentos FOR ALL
TO authenticated
USING (
    public.eh_admin_gnoth()
    OR EXISTS (
        SELECT 1 FROM public.pacientes p
        WHERE p.id = pagamentos.paciente_id AND p.psicologa_id = auth.uid()
    )
)
WITH CHECK (
    public.eh_admin_gnoth()
    OR EXISTS (
        SELECT 1 FROM public.pacientes p
        WHERE p.id = pagamentos.paciente_id AND p.psicologa_id = auth.uid()
    )
);

-- 7.7 prontuarios_historico
ALTER TABLE public.prontuarios_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Psicologa ou Admin gerencia prontuarios" ON public.prontuarios_historico;
CREATE POLICY "Psicologa ou Admin gerencia prontuarios"
ON public.prontuarios_historico FOR ALL
TO authenticated
USING (
    public.eh_admin_gnoth()
    OR EXISTS (
        SELECT 1 FROM public.pacientes p
        WHERE p.id = prontuarios_historico.paciente_id AND p.psicologa_id = auth.uid()
    )
)
WITH CHECK (
    public.eh_admin_gnoth()
    OR EXISTS (
        SELECT 1 FROM public.pacientes p
        WHERE p.id = prontuarios_historico.paciente_id AND p.psicologa_id = auth.uid()
    )
);
