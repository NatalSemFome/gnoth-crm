// Configuração do tema Tailwind apontando para as variáveis dinâmicas
if (typeof tailwind !== 'undefined') {
    tailwind.config = {
        theme: {
            extend: {
                colors: {
                    brand: {
                        50: 'var(--brand-50)',
                        100: 'var(--brand-100)',
                        150: 'var(--brand-150)',
                        200: 'var(--brand-200)',
                        300: 'var(--brand-300)',
                        400: 'var(--brand-400)',
                        500: 'var(--brand-500)',
                        600: 'var(--brand-600)',
                        700: 'var(--brand-700)',
                        text: 'var(--brand-text)',
                        subtext: 'var(--brand-subtext)',
                    }
                },
                fontFamily: {
                    sans: ['Montserrat', 'sans-serif'],
                    serif: ['Playfair Display', 'serif'],
                    script: ['Great Vibes', 'cursive'],
                }
            }
        }
    };
}

// Se for a LP de outro psicólogo, oculta até o Supabase carregar os dados dele (evita piscar a foto da Alexia)
(function() {
    const partes = window.location.pathname.split('/lp/');
    const slugUrl = partes[1] ? partes[1].replace(/\//g, '').trim() : 'AlexiaSturaro';
    if (slugUrl.toLowerCase() !== 'alexiasturaro') {
        document.documentElement.style.opacity = '0';
        document.documentElement.style.transition = 'opacity 0.25s ease';
    }
})();

window.addEventListener('DOMContentLoaded', () => {
    // Menu Mobile e Máscara de Telefone
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');

    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });

        mobileMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                mobileMenu.classList.add('hidden');
            });
        });
    }

    const wppInput = document.getElementById('whatsapp');
    if (wppInput) {
        wppInput.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length > 11) v = v.slice(0, 11);
            if (v.length > 6) {
                v = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
            } else if (v.length > 2) {
                v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
            } else if (v.length > 0) {
                v = `(${v}`;
            }
            e.target.value = v;
        });
    }

    // Supabase JS Client + Motor Dinâmico Multi-Cliente
    const SUPABASE_URL = "https://yxxcclaaxlbdybssxjyw.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4eGNjbGFheGxiZHlic3N4anl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQzNjk4NDksImV4cCI6MjEwOTk0NTg0OX0.79Y7Eu9qXhqDl4uh7jfadeW8fR7IwUwSTpJJ7BQNM5Y";

    const supaClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Identifica o slug pela URL (ex: /lp/AlexiaSturaro -> 'AlexiaSturaro')
    function obterSlugDaUrl() {
        const partes = window.location.pathname.split('/').filter(Boolean);
        const indiceLp = partes.findIndex(p => p.toLowerCase() === 'lp');
        if (indiceLp !== -1 && partes[indiceLp + 1]) {
            return partes[indiceLp + 1];
        }
        return 'AlexiaSturaro'; // Fallback padrão
    }

    let slugAtual = obterSlugDaUrl();

    // Carrega os dados personalizados caso exista na tabela landing_pages
    async function carregarDadosProfissional() {
        try {
            const { data, error } = await supaClient
                .from('landing_pages')
                .select('*')
                .ilike('slug', slugAtual)
                .eq('ativo', true)
                .maybeSingle();

            // 1. Se o psicólogo não existir ou estiver inativo (e não for a página padrão da Alexia):
            if ((error || !data) && slugAtual.toLowerCase() !== 'alexiasturaro') {
                document.body.innerHTML = `
                    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:sans-serif;background:#F7F5F8;color:#2D2633;text-align:center;padding:24px;">
                        <div>
                            <h1 style="font-size:24px;margin-bottom:8px;">Página não encontrada</h1>
                            <p style="color:#6E6278;font-size:14px;margin-bottom:20px;">Este endereço não está ativo no momento.</p>
                            <a href="https://gnoth.com.br" style="background:#736185;color:#fff;padding:10px 20px;border-radius:10px;text-decoration:none;font-size:14px;">Conhecer o Gnoth</a>
                        </div>
                    </div>`;
                return;
            }

            // 2. Se for a Alexia e ainda não tiver linha no banco, mantém o HTML padrão dela:
            if (error || !data) return;

            // 3. Atualiza as cores dinâmicas da página
            if (data.cor_500) document.documentElement.style.setProperty('--brand-500', data.cor_500);
            if (data.cor_600) document.documentElement.style.setProperty('--brand-600', data.cor_600);
            if (data.cor_700) document.documentElement.style.setProperty('--brand-700', data.cor_700);

            // 4. Atualiza o título da aba do navegador
            if (data.nome) {
                document.title = `${data.nome} | Psicologia Clínica`;
            }

            // 5. Atualiza os textos marcados com data-lp e data-lp-html
            document.querySelectorAll('[data-lp]').forEach(el => {
                const campo = el.getAttribute('data-lp');
                if (data[campo]) el.textContent = data[campo];
            });

            const elCrp = document.querySelector('[data-lp="crp"]');
            if (elCrp && (data.nome || data.crp)) {
                elCrp.textContent = [data.nome, data.crp ? `CRP ${data.crp.replace(/crp\s*/i, '')}` : ''].filter(Boolean).join(' • ');
            }

            document.querySelectorAll('[data-lp-html]').forEach(el => {
                const campo = el.getAttribute('data-lp-html');
                if (data[campo]) el.innerHTML = data[campo];
            });

            // 6. Atualiza a foto principal da Hero
            const fotoHero = document.getElementById('lpFotoHero');
            if (fotoHero && data.foto_url) {
                fotoHero.src = data.foto_url;
                if (data.nome) fotoHero.alt = `Psicóloga ${data.nome}`;
            }

            // 7. Atualiza o link do botão flutuante de WhatsApp
            const wppLink = document.getElementById('floatingWppLink');
            if (wppLink && data.whatsapp) {
                const numLimpo = data.whatsapp.replace(/\D/g, '');
                const msg = encodeURIComponent(`Olá, ${data.nome || ''}! Vim pelo seu site e gostaria de saber mais sobre o agendamento.`);
                wppLink.href = `https://wa.me/${numLimpo}?text=${msg}`;
            }
        } catch (e) {
            console.warn('Usando dados padrão da página:', e);
        } finally {
            // 8. Roda SEMPRE ao final e revela a página suavemente já com os dados do psicólogo
            document.documentElement.style.opacity = '1';
        }
    }

    carregarDadosProfissional();

    // Envio do Formulário de Triagem vinculado ao slug do profissional
    const form = document.getElementById("triageForm");
    const feedback = document.getElementById("formFeedback");

    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            const submitBtn = document.getElementById("submitBtn");
            const btnOriginalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = "Gravando...";

            if (feedback) {
                feedback.className = "text-center text-xs text-brand-500 font-semibold";
                feedback.textContent = "Processando agendamento...";
            }

            const nome = document.getElementById("fullName").value.trim();
            const whatsapp = document.getElementById("whatsapp").value.trim();
            const modalidade = document.getElementById("modality").value;
            const checkboxes = document.querySelectorAll('input[name="timePref"]:checked');
            const periodos = Array.from(checkboxes).map(cb => cb.value).join(", ") || "Flexível";
            const motivo = document.getElementById("message") ? document.getElementById("message").value.trim() : "";

            try {
                const { error } = await supaClient
                    .from('pacientes')
                    .insert([{
                        nome: nome,
                        whatsapp: whatsapp,
                        modalidade: modalidade,
                        periodo_preferencia: periodos,
                        motivo_consulta: motivo,
                        status: 'Novo Contato',
                        profissional_slug: slugAtual
                    }]);

                if (error) {
                    console.error("Erro Supabase:", error);
                    if (feedback) {
                        feedback.className = "text-center text-xs text-red-500 font-semibold";
                        feedback.textContent = "Erro ao enviar: " + error.message;
                    }
                } else {
                    if (feedback) {
                        feedback.className = "text-center text-xs text-emerald-600 font-semibold";
                        feedback.textContent = "✓ Acolhimento solicitado com sucesso! Entraremos em contato via WhatsApp.";
                    }
                    form.reset();
                }
            } catch (err) {
                console.error("Exceção:", err);
                if (feedback) {
                    feedback.className = "text-center text-xs text-red-500 font-semibold";
                    feedback.textContent = "Ocorreu um erro inesperado.";
                }
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = btnOriginalText;
            }
        });
    }
});
