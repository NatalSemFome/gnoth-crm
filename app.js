const SUPABASE_URL = "https://yxxcclaaxlbdybssxjyw.supabase.co";
        const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4eGNjbGFheGxiZHlic3N4anl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQzNjk4NDksImV4cCI6MjEwOTk0NTg0OX0.79Y7Eu9qXhqDl4uh7jfadeW8fR7IwUwSTpJJ7BQNM5Y";
        const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        const ABAS_VALIDAS = ['dashboard', 'agenda', 'agendar', 'clientes', 'leads', 'pagamentos', 'minha-lp', 'equipe', 'perfil'];
        const MAPA_ROTAS_ABAS = {
            home: 'dashboard',
            pacientes: 'clientes',
            triagens: 'leads',
            cobrancas: 'pagamentos',
            'minha-landing-page': 'minha-lp',
            'meu-perfil': 'perfil',
            conta: 'perfil'
        };

        function normalizarNomeAba(valor) {
            const limpo = String(valor || '').replace(/^[/#]+|[/]+$/g, '').toLowerCase();
            if (ABAS_VALIDAS.includes(limpo)) return limpo;
            if (MAPA_ROTAS_ABAS[limpo]) return MAPA_ROTAS_ABAS[limpo];
            return null;
        }

        function obterAbaDaUrl() {
            const pathSeg = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
            const abaPorPath = normalizarNomeAba(pathSeg);
            if (abaPorPath) return abaPorPath;

            const hash = window.location.hash.replace('#', '');
            if (hash && !hash.includes('type=recovery') && !hash.includes('access_token=')) {
                const abaPorHash = normalizarNomeAba(hash);
                if (abaPorHash) return abaPorHash;
            }
            return 'dashboard';
        }

        function mudarAba(nomeAba, opcoes = {}) {
            const abaNormalizada = normalizarNomeAba(nomeAba) || 'dashboard';
            nomeAba = abaNormalizada;

            if (nomeAba === 'equipe' && typeof ehAdmin === 'function' && usuarioAtualPerfil && !ehAdmin()) {
                alert("Acesso restrito apenas para Administradores.");
                return;
            }

            if (nomeAba === 'minha-lp' && usuarioAtualPerfil && !ehAdmin() && !usuarioTemLPComprada) {
                alert("Acesso disponível apenas para profissionais que possuem a Landing Page adquirida.");
                mudarAba('dashboard', { substituir: true });
                return;
            }

            const params = new URLSearchParams(window.location.search);
            const emFluxoEspecial = params.has('triagem') || window.location.hash.includes('type=recovery') || window.location.hash.includes('access_token=');

            if (!emFluxoEspecial && !opcoes.naoAtualizarUrl) {
                if (window.location.protocol === 'file:') {
                    window.location.hash = nomeAba;
                } else {
                    const novaUrl = '/' + nomeAba + (params.has('modo') ? `?modo=${params.get('modo')}` : '');
                    const urlAtual = window.location.pathname + window.location.search + window.location.hash;
                    if (opcoes.substituir) {
                        window.history.replaceState({ aba: nomeAba }, '', novaUrl);
                    } else if (urlAtual !== novaUrl) {
                        window.history.pushState({ aba: nomeAba }, '', novaUrl);
                    }
                }
            }

            document.querySelectorAll('.secao-conteudo').forEach(secao => {
                secao.style.display = 'none';
            });

            document.querySelectorAll('.sidebar-link').forEach(btn => {
                btn.classList.remove('ativo');
            });

            const btnAlvo = document.getElementById('btn-' + nomeAba);
            if (btnAlvo) btnAlvo.classList.add('ativo');

            const abaAlvo = document.getElementById('secao-' + nomeAba);
            if (abaAlvo) {
                abaAlvo.style.display = 'block';
                if (nomeAba === 'agendar' && typeof prepararTelaAgendamento === 'function') prepararTelaAgendamento();
                if (nomeAba === 'agenda' && typeof renderizarCalendario === 'function') renderizarCalendario();
                if (nomeAba === 'equipe' && typeof carregarEquipe === 'function') carregarEquipe();
                if (nomeAba === 'pagamentos' && typeof aplicarFiltrosCobrancas === 'function') aplicarFiltrosCobrancas();
                if (nomeAba === 'minha-lp' && typeof carregarDadosMinhaLP === 'function') carregarDadosMinhaLP();
                if (nomeAba === 'perfil' && typeof carregarPaginaPerfil === 'function') carregarPaginaPerfil();
            }
        }

        window.addEventListener('DOMContentLoaded', () => {
            const pathSeg = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
            if (pathSeg === 'cadastro') {
                alternarTelaAuth('cadastro');
            }
            const abaInicial = obterAbaDaUrl();
            const manterRotaAuth = pathSeg === 'cadastro' || pathSeg === 'login';
            mudarAba(abaInicial, { substituir: true, naoAtualizarUrl: manterRotaAuth });
        });

        window.addEventListener('popstate', () => {
            const abaAtual = obterAbaDaUrl();
            mudarAba(abaAtual, { naoAtualizarUrl: true });
        });

        window.addEventListener('hashchange', () => {
            if (window.location.hash.includes('type=recovery') || window.location.hash.includes('access_token=')) return;
            const abaAtual = obterAbaDaUrl();
            mudarAba(abaAtual, { substituir: true });
        });

        let todosPacientesCache = [];
        let todosAtendimentosCache = [];
        let todosPagamentosCache = [];
        let todosUsuariosCache = [];
        let todasLPsCache = [];
        let usuarioAtualPerfil = null;
        let usuarioTemLPComprada = false;
        let lpUsuarioSelecionadoId = null;
        let pacienteSelecionadoId = null;
        let dataCalendarioAtual = new Date();
        let diaSelecionadoAgendaIso = null;
        let modalidadeSelecionadaAgendamento = 'Online';
        let filtroClienteAtivo = 'Todos';
        let filtroCobrancaAtivo = 'Todas';

        let recognition = null;
        let gravando = false;
        let usuarioPediuParaParar = false;

        function obterChaveDiaLocal(dateObj = new Date()) {
            const ano = dateObj.getFullYear();
            const mes = String(dateObj.getMonth() + 1).padStart(2, '0');
            const dia = String(dateObj.getDate()).padStart(2, '0');
            return `${ano}-${mes}-${dia}`;
        }

        function formatarBRL(val) {
            return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }

        function escapeHtml(texto) {
            if (!texto) return '';
            return String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
        }

        function ehAdmin() {
            return usuarioAtualPerfil && usuarioAtualPerfil.role === 'admin';
        }

        function obterNomeExibicaoUsuario() {
            if (usuarioAtualPerfil && usuarioAtualPerfil.nome && usuarioAtualPerfil.nome.trim() !== '') {
                return usuarioAtualPerfil.nome.trim();
            }
            if (usuarioAtualPerfil && usuarioAtualPerfil.email) {
                return usuarioAtualPerfil.email.split('@')[0];
            }
            return 'Doutora';
        }

        function atualizarSaudacao() {
            const agora = new Date();
            const hora = agora.getHours();
            const nomeUsuario = obterNomeExibicaoUsuario();
            const primeiroNome = nomeUsuario.split(' ')[0];

            let saudacao = `Bom dia, ${primeiroNome}`;
            if (hora >= 12 && hora < 18) saudacao = `Boa tarde, ${primeiroNome}`;
            else if (hora >= 18 || hora < 5) saudacao = `Boa noite, ${primeiroNome}`;
            
            const saudacaoEl = document.getElementById('saudacaoHoje');
            if (saudacaoEl) saudacaoEl.textContent = saudacao;

            const dataFormatada = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
            const dataHojeEl = document.getElementById('dataHojeFormatada');
            if (dataHojeEl) dataHojeEl.textContent = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);

            const headerNome = document.getElementById('headerUserNome');
            if (headerNome) headerNome.textContent = nomeUsuario;

            const iniciais = nomeUsuario.split(' ').filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase() || 'PS';
            const headerIniciais = document.getElementById('headerUserIniciais');
            if (headerIniciais) headerIniciais.textContent = iniciais;
        }

        let psicologaTriagemPublicaId = null;

        window.addEventListener('DOMContentLoaded', async () => {
            diaSelecionadoAgendaIso = obterChaveDiaLocal();

            const params = new URLSearchParams(window.location.search);
            if (params.get('modo') === 'cadastro') {
                alternarTelaAuth('cadastro');
            }

            const triagemPsiId = params.get('triagem');
            if (triagemPsiId) {
                psicologaTriagemPublicaId = triagemPsiId;
                document.getElementById('loginScreen').classList.add('hidden');
                document.getElementById('publicTriagemScreen').classList.remove('hidden');
                const { data: psi } = await client.from('usuarios_perfis').select('nome, crp, abordagem').eq('id', triagemPsiId).single();
                if (psi) {
                    document.getElementById('publicPsiNome').textContent = psi.nome || 'Atendimento Psicológico';
                    const detalhes = [psi.crp ? 'CRP ' + psi.crp : '', psi.abordagem || ''].filter(Boolean).join(' · ');
                    if (detalhes) document.getElementById('publicPsiInfo').textContent = detalhes;
                }
                return;
            }

            if (window.location.hash.includes('type=recovery')) {
                document.getElementById('loginScreen').classList.add('hidden');
                document.getElementById('recoveryScreen').classList.remove('hidden');
                return;
            }
            const { data: { session } } = await client.auth.getSession();
            if (session) {
                await checarPerfilUsuario(session.user.id, session.user.email);
                mostrarApp();
            }
        });

        document.getElementById('formTriagemPublica').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btnEnviarTriagemPub');
            btn.disabled = true;
            btn.textContent = "Enviando...";

            const payload = {
                nome: document.getElementById('pubNome').value.trim(),
                whatsapp: document.getElementById('pubWhatsapp').value.trim(),
                modalidade: document.getElementById('pubModalidade').value,
                periodo_preferencia: document.getElementById('pubPeriodo').value,
                motivo_consulta: document.getElementById('pubMotivo').value.trim() || null,
                lgpd_aceito: true,
                lgpd_aceito_em: new Date().toISOString(),
                status: 'Novo Contato',
                psicologa_id: psicologaTriagemPublicaId
            };

            const { error } = await client.from('pacientes').insert([payload]);
            btn.disabled = false;
            btn.textContent = "Enviar Solicitação";

            if (error) {
                alert("Erro ao enviar solicitação: " + error.message);
            } else {
                document.getElementById('formTriagemPublica').classList.add('hidden');
                document.getElementById('publicTriagemSucesso').classList.remove('hidden');
            }
        });

        function copiarLinkTriagem() {
            if (!usuarioAtualPerfil || !usuarioAtualPerfil.id) return;
            const linkExclusivo = `${window.location.origin}/triagem?triagem=${usuarioAtualPerfil.id}`;
            navigator.clipboard.writeText(linkExclusivo).then(() => {
                const statusEl = document.getElementById('statusCopiaLink');
                if (statusEl) {
                    statusEl.textContent = "✓ Copiado!";
                    setTimeout(() => { statusEl.textContent = "Copiar"; }, 2500);
                }
                alert("Link exclusivo copiado!\n\nCole na bio do seu Instagram:\n" + linkExclusivo);
            });
        }

        client.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
                document.getElementById('loginScreen').classList.add('hidden');
                document.getElementById('appScreen').classList.add('hidden');
                document.getElementById('recoveryScreen').classList.remove('hidden');
            }
        });

        function esconderTodasTelasAuth() {
            ['loginForm', 'signupForm', 'recuperarSenhaForm', 'recuperarEnviadoBox'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add('hidden');
            });
            const errEl = document.getElementById('recuperarError');
            if (errEl) errEl.textContent = '';
        }

        function abrirTelaRecuperarSenha() {
            esconderTodasTelasAuth();
            const emailDigitadoNoLogin = document.getElementById('loginEmail')?.value?.trim();
            const inputRec = document.getElementById('recuperarEmailInput');
            if (inputRec && emailDigitadoNoLogin) {
                inputRec.value = emailDigitadoNoLogin;
            }
            document.getElementById('recuperarSenhaForm').classList.remove('hidden');
            if (inputRec) inputRec.focus();
        }

        function voltarParaLogin() {
            esconderTodasTelasAuth();
            document.getElementById('loginForm').classList.remove('hidden');
        }

        document.getElementById('recuperarSenhaForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('recuperarEmailInput').value.trim();
            const btn = document.getElementById('btnEnviarRecuperacao');
            const errEl = document.getElementById('recuperarError');
            if (!email) return;

            btn.disabled = true;
            btn.textContent = "Enviando link...";
            if (errEl) errEl.textContent = "";

            try {
                const { error } = await client.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin + '/dashboard'
                });
                if (error) throw error;

                esconderTodasTelasAuth();
                document.getElementById('emailRecuperacaoDestino').textContent = email;
                document.getElementById('recuperarEnviadoBox').classList.remove('hidden');
            } catch (err) {
                if (errEl) errEl.textContent = "Erro ao enviar e-mail: " + err.message;
            } finally {
                btn.disabled = false;
                btn.textContent = "Enviar link de redefinição";
            }
        });
        
        document.getElementById('recoveryForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const novaSenha = document.getElementById('newPassword').value;
            const confirmaSenha = document.getElementById('confirmNewPassword').value;
            const feedbackEl = document.getElementById('recoveryFeedback');
            const btn = document.getElementById('recoverySubmitBtn');

            if (novaSenha !== confirmaSenha) {
                feedbackEl.className = "text-xs text-red-400 text-center font-medium";
                feedbackEl.textContent = "As senhas não coincidem.";
                return;
            }

            btn.disabled = true;
            btn.textContent = "Salvando...";

            const { error } = await client.auth.updateUser({ password: novaSenha });

            btn.disabled = false;
            btn.textContent = "Salvar Nova Senha";

            if (error) {
                feedbackEl.className = "text-xs text-red-400 text-center font-medium";
                feedbackEl.textContent = "Erro ao atualizar senha: " + error.message;
            } else {
                feedbackEl.className = "text-xs text-emerald-400 text-center font-medium";
                feedbackEl.textContent = "✓ Senha alterada com sucesso! Entrando no painel...";
                window.history.replaceState({}, document.title, window.location.pathname);
                setTimeout(() => {
                    document.getElementById('recoveryScreen').classList.add('hidden');
                    window.location.reload();
                }, 1200);
            }
        });

        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;
            const erroEl = document.getElementById('loginError');
            const btn = document.getElementById('loginSubmitBtn');
            erroEl.textContent = ""; btn.textContent = "Validando..."; btn.disabled = true;

            try {
                const { data, error } = await client.auth.signInWithPassword({ email, password });
                btn.textContent = "Entrar no Painel"; btn.disabled = false;
                if (error) {
                    erroEl.className = "text-xs text-red-400 text-center font-medium min-h-[16px]";
                    erroEl.textContent = "Dados incorretos: " + error.message;
                } else {
                    await checarPerfilUsuario(data.user.id, data.user.email);
                    mostrarApp();
                }
            } catch (err) {
                btn.textContent = "Entrar no Painel"; btn.disabled = false;
                erroEl.className = "text-xs text-red-400 text-center font-medium min-h-[16px]";
                erroEl.textContent = "Falha na conexão: " + err.message;
            }
        });

        async function checarPerfilUsuario(userId, fallbackEmail = '') {
            try {
                // Consulta limpa e direta à tabela de perfis do Supabase
                const { data, error } = await client
                    .from('usuarios_perfis')
                    .select('*')
                    .eq('id', userId)
                    .single();

                if (error || !data) {
                    // Se por algum motivo o perfil ainda não existir na tabela, cria um registro padrão limpo baseado no e-mail
                    usuarioAtualPerfil = { 
                        id: userId, 
                        email: fallbackEmail, 
                        nome: fallbackEmail.split('@')[0], 
                        role: 'psicologo' 
                    };
                } else {
                    usuarioAtualPerfil = data;
                }
            } catch(e) {
                usuarioAtualPerfil = { 
                    id: userId, 
                    email: fallbackEmail, 
                    nome: fallbackEmail.split('@')[0], 
                    role: 'psicologo' 
                };
            }
            
            atualizarSaudacao();
            atualizarBadgeTrial();

            const badge = document.getElementById('userRoleBadge');
            const btnEquipe = document.getElementById('btn-equipe');
            const btnMinhaLp = document.getElementById('btn-minha-lp');
            const thPsicologa = document.getElementById('thPsicologaResponsavel');

            // Verifica se o usuário possui Landing Page comprada/liberada (ou é Admin)
            if (ehAdmin()) {
                usuarioTemLPComprada = true;
            } else {
                try {
                    const { data: lpUser } = await client
                        .from('landing_pages')
                        .select('id')
                        .eq('user_id', userId)
                        .maybeSingle();
                    usuarioTemLPComprada = Boolean(lpUser) || Boolean(usuarioAtualPerfil?.tem_lp);
                } catch (e) {
                    usuarioTemLPComprada = Boolean(usuarioAtualPerfil?.tem_lp);
                }
            }

            if (btnMinhaLp) {
                if (ehAdmin() || usuarioTemLPComprada) {
                    btnMinhaLp.classList.remove('hidden');
                } else {
                    btnMinhaLp.classList.add('hidden');
                }
            }

            // Regra pura baseada unicamente no campo 'role' salvo no banco de dados
            if (ehAdmin()) {
                if (badge) {
                    badge.textContent = "Administrador";
                    badge.className = "px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-400/30";
                }
                if (btnEquipe) btnEquipe.classList.remove('hidden');
                if (thPsicologa) thPsicologa.classList.remove('hidden');
            } else {
                if (badge) {
                    badge.textContent = "Psicóloga";
                    badge.className = "px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white/10 text-[#E5DCED]";
                }
                if (btnEquipe) btnEquipe.classList.add('hidden');
                if (thPsicologa) thPsicologa.classList.add('hidden');
            }

            const abaAtual = obterAbaDaUrl();
            if (abaAtual === 'minha-lp') {
                if (!ehAdmin() && !usuarioTemLPComprada) {
                    mudarAba('dashboard', { substituir: true });
                } else if (typeof carregarDadosMinhaLP === 'function') {
                    carregarDadosMinhaLP();
                }
            } else if (abaAtual === 'equipe' && !ehAdmin()) {
                mudarAba('dashboard', { substituir: true });
            } else if (abaAtual === 'perfil' && typeof carregarPaginaPerfil === 'function') {
                carregarPaginaPerfil();
            }

            if (ehAdmin() && typeof carregarEquipe === 'function') {
                carregarEquipe();
            }
        }

        async function sair() {
            await client.auth.signOut();
            if (window.location.protocol !== 'file:') {
                window.location.href = '/login';
            } else {
                window.location.reload();
            }
        }

        let canalRealtime = null;
        let realtimeConectado = false;
        let intervaloAutoSync = null;
        let timeoutDebounceSync = null;
        let carregandoDadosEmAndamento = false;
        let versaoMutacaoLocal = 0;
        let qtdLeadsAnterior = null;

        function alternarInstrucoesReceitaSaude() {
            const el = document.getElementById('painelInstrucoesReceitaSaude');
            if (!el) return;
            const estaOculto = el.classList.contains('hidden') || el.style.display === 'none';
            if (estaOculto) {
                el.classList.remove('hidden');
                el.style.display = 'block';
            } else {
                el.classList.add('hidden');
                el.style.display = 'none';
            }
        }

        function exibirToastTempoReal(mensagem) {
            let toast = document.getElementById('toastTempoRealGnoth');
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'toastTempoRealGnoth';
                toast.className = 'fixed bottom-5 right-5 z-50 px-4 py-3 rounded-2xl bg-[#2B2138] border border-purple-400/40 text-xs font-semibold text-white shadow-2xl transition-all duration-300 opacity-0 translate-y-2 pointer-events-none flex items-center gap-2';
                document.body.appendChild(toast);
            }
            toast.innerHTML = `<span>🔔</span><span>${escapeHtml(mensagem)}</span>`;
            toast.classList.remove('opacity-0', 'translate-y-2');
            clearTimeout(toast._hideTimer);
            toast._hideTimer = setTimeout(() => {
                toast.classList.add('opacity-0', 'translate-y-2');
            }, 4000);
        }

        function agendarSincronizacaoTempoReal(tabelaAfetada = '') {
            if (!usuarioAtualPerfil || !usuarioAtualPerfil.id) return;
            clearTimeout(timeoutDebounceSync);
            timeoutDebounceSync = setTimeout(async () => {
                await carregarDados({ silencioso: true });
                const abaAtual = obterAbaDaUrl();
                if (abaAtual === 'equipe' && ehAdmin() && ( !tabelaAfetada || tabelaAfetada === 'usuarios_perfis' || tabelaAfetada === 'landing_pages')) {
                    carregarEquipe();
                }
            }, 350);
        }

        function iniciarSincronizacaoTempoReal() {
            if (!canalRealtime) {
                try {
                    canalRealtime = client
                        .channel('gnothi-crm-realtime')
                        .on('postgres_changes', { event: '*', schema: 'public', table: 'pacientes' }, () => agendarSincronizacaoTempoReal('pacientes'))
                        .on('postgres_changes', { event: '*', schema: 'public', table: 'atendimentos' }, () => agendarSincronizacaoTempoReal('atendimentos'))
                        .on('postgres_changes', { event: '*', schema: 'public', table: 'pagamentos' }, () => agendarSincronizacaoTempoReal('pagamentos'))
                        .on('postgres_changes', { event: '*', schema: 'public', table: 'prontuarios_historico' }, () => agendarSincronizacaoTempoReal('prontuarios_historico'))
                        .on('postgres_changes', { event: '*', schema: 'public', table: 'usuarios_perfis' }, () => agendarSincronizacaoTempoReal('usuarios_perfis'))
                        .on('postgres_changes', { event: '*', schema: 'public', table: 'landing_pages' }, () => agendarSincronizacaoTempoReal('landing_pages'))
                        .subscribe((status) => {
                            realtimeConectado = (status === 'SUBSCRIBED');
                        });
                } catch (e) {
                    realtimeConectado = false;
                }
            }

            if (!intervaloAutoSync) {
                let ultimoSyncAutomatico = Date.now();
                intervaloAutoSync = setInterval(() => {
                    if (document.visibilityState !== 'visible' || !usuarioAtualPerfil || !usuarioAtualPerfil.id) return;
                    const intervaloAlvo = realtimeConectado ? 45000 : 12000;
                    if (Date.now() - ultimoSyncAutomatico >= intervaloAlvo) {
                        ultimoSyncAutomatico = Date.now();
                        carregarDados({ silencioso: true });
                    }
                }, 6000);

                window.addEventListener('focus', () => {
                    if (usuarioAtualPerfil && usuarioAtualPerfil.id) {
                        ultimoSyncAutomatico = Date.now();
                        carregarDados({ silencioso: true });
                    }
                });

                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'visible' && usuarioAtualPerfil && usuarioAtualPerfil.id) {
                        ultimoSyncAutomatico = Date.now();
                        carregarDados({ silencioso: true });
                    }
                });
            }
        }

        function mostrarApp() {
            document.getElementById('loginScreen').classList.add('hidden');
            document.getElementById('appScreen').classList.remove('hidden');
            mudarAba(obterAbaDaUrl(), { substituir: true });
            carregarDados();
            iniciarSincronizacaoTempoReal();
        }

        function alternarMenuMobile() {
            const sidebar = document.getElementById('sidebarPrincipal');
            if (sidebar) {
                sidebar.classList.toggle('hidden');
                document.body.classList.toggle('overflow-hidden', !sidebar.classList.contains('hidden'));
            }
        }

        function trocarAbaMobile(aba) {
            mudarAba(aba);
            if (window.innerWidth < 768) {
                const sidebar = document.getElementById('sidebarPrincipal');
                if (sidebar) sidebar.classList.add('hidden');
                document.body.classList.remove('overflow-hidden');
            }
        }

        function fecharModal(modalId) {
            const el = document.getElementById(modalId);
            if (!el) return;
            el.classList.add('hidden');
            el.style.display = '';
        }

        async function carregarDados(opcoes = {}) {
            if (carregandoDadosEmAndamento && opcoes.silencioso) return;
            if (!usuarioAtualPerfil || !usuarioAtualPerfil.id) return;
            carregandoDadosEmAndamento = true;
            const versaoInicio = versaoMutacaoLocal;
            try {
                const isAdmin = ehAdmin();

                // 1. Filtra já no banco (Supabase) para não expor dados de outros profissionais na rede
                const queryUsuarios = isAdmin
                    ? client.from('usuarios_perfis').select('*').order('nome', { ascending: true })
                    : client.from('usuarios_perfis').select('*').eq('id', usuarioAtualPerfil.id);

                const queryPacientes = isAdmin
                    ? client.from('pacientes').select('*').is('excluido_em', null).order('created_at', { ascending: false })
                    : client.from('pacientes').select('*').is('excluido_em', null).eq('psicologa_id', usuarioAtualPerfil.id).order('created_at', { ascending: false });

                const [{ data: usuarios }, { data: pacientes }] = await Promise.all([queryUsuarios, queryPacientes]);
                if (opcoes.silencioso && versaoMutacaoLocal !== versaoInicio) return;

                todosUsuariosCache = usuarios || [usuarioAtualPerfil];
                todosPacientesCache = pacientes || [];

                const clientes = todosPacientesCache.filter(p => p.status !== 'Novo Contato');
                const leads = todosPacientesCache.filter(p => p.status === 'Novo Contato');

                if (qtdLeadsAnterior !== null && leads.length > qtdLeadsAnterior) {
                    exibirToastTempoReal('Nova triagem recebida no painel!');
                }
                qtdLeadsAnterior = leads.length;

                document.getElementById('kpiClientesAtivos').textContent = clientes.length;
                document.getElementById('kpiLeadsPendentes').textContent = leads.length;

                const badgeLeads = document.getElementById('badgeLeads');
                if (badgeLeads) {
                    if (leads.length > 0) {
                        badgeLeads.textContent = leads.length;
                        badgeLeads.classList.remove('hidden');
                    } else {
                        badgeLeads.classList.add('hidden');
                    }
                }

                const avisoTriagemTexto = document.getElementById('textoAvisoTriagem');
                if (avisoTriagemTexto) {
                    avisoTriagemTexto.textContent = `${leads.length} ${leads.length === 1 ? 'triagem nova' : 'triagens novas'}`;
                }

                const idsClientesLista = clientes.map(c => c.id);
                let atendimentos = [];
                let pagamentos = [];
                let prontuariosRecentes = [];

                if (isAdmin) {
                    const [resAtend, resPag, resPront] = await Promise.all([
                        client.from('atendimentos').select('*, pacientes(nome, whatsapp, modalidade, valor_padrao_sessao, psicologa_id)').is('excluido_em', null).order('data_hora', { ascending: true }),
                        client.from('pagamentos').select('*, pacientes(nome, whatsapp)').is('excluido_em', null).order('data_vencimento', { ascending: false }),
                        client.from('prontuarios_historico').select('paciente_id, criado_em').is('excluido_em', null).order('criado_em', { ascending: false })
                    ]);
                    atendimentos = resAtend.data || [];
                    pagamentos = resPag.data || [];
                    prontuariosRecentes = resPront.data || [];
                } else if (idsClientesLista.length > 0) {
                    const [resAtend, resPag, resPront] = await Promise.all([
                        client.from('atendimentos').select('*, pacientes(nome, whatsapp, modalidade, valor_padrao_sessao, psicologa_id)').is('excluido_em', null).in('paciente_id', idsClientesLista).order('data_hora', { ascending: true }),
                        client.from('pagamentos').select('*, pacientes(nome, whatsapp)').is('excluido_em', null).in('paciente_id', idsClientesLista).order('data_vencimento', { ascending: false }),
                        client.from('prontuarios_historico').select('paciente_id, criado_em').is('excluido_em', null).in('paciente_id', idsClientesLista).order('criado_em', { ascending: false })
                    ]);
                    atendimentos = resAtend.data || [];
                    pagamentos = resPag.data || [];
                    prontuariosRecentes = resPront.data || [];
                }

                if (opcoes.silencioso && versaoMutacaoLocal !== versaoInicio) return;

                todosAtendimentosCache = atendimentos;
                todosPagamentosCache = pagamentos;

                gerarNotificacoesInteligentes(todosPacientesCache, todosAtendimentosCache, prontuariosRecentes);
                renderizarCronogramaHoje(todosAtendimentosCache);
                renderizarProximosEAlertas(todosAtendimentosCache);
                aplicarFiltrosClientes();
                renderizarTriagensCards(leads);
                renderizarCalendario();
                aplicarFiltrosCobrancas();
                atualizarKpisFinanceiros(todosPagamentosCache);
                if (typeof prepararTelaAgendamento === 'function') {
                    prepararTelaAgendamento({ preservarSelecao: true });
                }
            } finally {
                carregandoDadosEmAndamento = false;
            }
        }
        let minhaLPAtual = null;

        function obterUsuarioAlvoLP() {
            if (ehAdmin() && lpUsuarioSelecionadoId) {
                const encontrado = todosUsuariosCache.find(u => u.id === lpUsuarioSelecionadoId);
                if (encontrado) return encontrado;
            }
            return usuarioAtualPerfil;
        }

        function atualizarPreviewLinkLP() {
            const slugInput = document.getElementById('lpEditSlug');
            const slugLimpo = (slugInput.value || '').replace(/[^a-zA-Z0-9_-]/g, '');
            slugInput.value = slugLimpo;
            const urlCompleta = `https://gnoth.com.br/lp/${slugLimpo || 'seu-nome'}`;
            document.getElementById('lpUrlPreview').textContent = `gnoth.com.br/lp/${slugLimpo || 'seu-nome'}`;
            document.getElementById('btnAbrirMinhaLP').href = urlCompleta;
        }

        function copiarLinkMinhaLP() {
            const slug = document.getElementById('lpEditSlug').value.trim();
            if (!slug) {
                alert("Defina e salve o final do seu link (slug) primeiro!");
                return;
            }
            const url = `https://gnoth.com.br/lp/${slug}`;
            navigator.clipboard.writeText(url);
            alert("Link copiado para a área de transferência:\n" + url);
        }

        async function prepararFiltroAdminLP() {
            const adminBox = document.getElementById('adminFiltroLPBox');
            const selectUser = document.getElementById('filtroUsuarioLP');
            const selectStatus = document.getElementById('filtroStatusCompraLP');
            if (!adminBox || !selectUser) return;

            if (!ehAdmin()) {
                adminBox.classList.add('hidden');
                return;
            }

            adminBox.classList.remove('hidden');

            if (todosUsuariosCache.length === 0) {
                const { data: usuarios } = await client.from('usuarios_perfis').select('*').order('nome', { ascending: true });
                todosUsuariosCache = usuarios || [];
            }

            const { data: lps } = await client.from('landing_pages').select('id, user_id, slug, ativo, nome');
            todasLPsCache = lps || [];
            const idsComLP = new Set(todasLPsCache.map(item => item.user_id));

            const statusFiltro = selectStatus ? selectStatus.value : 'todos';
            const listaFiltrada = todosUsuariosCache.filter(u => {
                const temLP = idsComLP.has(u.id) || Boolean(u.tem_lp);
                if (statusFiltro === 'com_lp') return temLP;
                if (statusFiltro === 'sem_lp') return !temLP;
                return true;
            });

            if (!lpUsuarioSelecionadoId) {
                lpUsuarioSelecionadoId = usuarioAtualPerfil.id;
            }

            if (listaFiltrada.length > 0 && !listaFiltrada.some(u => u.id === lpUsuarioSelecionadoId)) {
                lpUsuarioSelecionadoId = listaFiltrada[0].id;
            }

            if (listaFiltrada.length === 0) {
                selectUser.innerHTML = `<option value="${usuarioAtualPerfil.id}">Nenhum usuário neste filtro</option>`;
            } else {
                selectUser.innerHTML = listaFiltrada.map(u => {
                    const temLP = idsComLP.has(u.id) || Boolean(u.tem_lp);
                    const nomeExibicao = u.nome || (u.email ? u.email.split('@')[0] : 'Sem nome');
                    const tagVoce = u.id === usuarioAtualPerfil.id ? ' (Você)' : '';
                    const tagLP = temLP ? '🌐 Com LP' : '🔒 Sem LP';
                    return `<option value="${u.id}" ${u.id === lpUsuarioSelecionadoId ? 'selected' : ''}>${escapeHtml(nomeExibicao)}${tagVoce} — ${tagLP}</option>`;
                }).join('');
            }
        }

        function atualizarBadgesAdminLP(temLP, alvo) {
            const badge = document.getElementById('badgeStatusCompraLP');
            const btnLiberar = document.getElementById('btnLiberarLPAdmin');
            const btnRevogar = document.getElementById('btnRevogarLPAdmin');
            const tituloSecao = document.getElementById('tituloSecaoLP');

            if (tituloSecao) {
                if (ehAdmin() && alvo && alvo.id !== usuarioAtualPerfil.id) {
                    const nomeAlvo = alvo.nome || (alvo.email ? alvo.email.split('@')[0] : 'Profissional');
                    tituloSecao.textContent = `Landing Page · ${nomeAlvo}`;
                } else {
                    tituloSecao.textContent = 'Minha Landing Page';
                }
            }

            if (!ehAdmin()) return;

            if (badge) {
                if (temLP) {
                    badge.textContent = '🌐 LP Comprada / Liberada';
                    badge.className = 'px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30';
                } else {
                    badge.textContent = '🔒 Sem LP (Aba oculta para este usuário)';
                    badge.className = 'px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30';
                }
            }

            if (btnLiberar) {
                btnLiberar.classList.toggle('hidden', temLP);
            }
            if (btnRevogar) {
                btnRevogar.classList.toggle('hidden', !temLP);
            }
        }

        async function aoMudarFiltroStatusCompraLP() {
            await prepararFiltroAdminLP();
            await carregarDadosMinhaLP(true);
        }

        async function aoMudarUsuarioLPAdmin() {
            const selectUser = document.getElementById('filtroUsuarioLP');
            if (selectUser && selectUser.value) {
                lpUsuarioSelecionadoId = selectUser.value;
            }
            await carregarDadosMinhaLP(true);
        }

        function abrirLPDoUsuarioAdmin(userId) {
            if (!ehAdmin()) return;
            lpUsuarioSelecionadoId = userId;
            const selectStatus = document.getElementById('filtroStatusCompraLP');
            if (selectStatus) selectStatus.value = 'todos';
            mudarAba('minha-lp');
        }

        async function liberarLPRapidoAdmin() {
            if (!ehAdmin()) return;
            const alvo = obterUsuarioAlvoLP();
            if (!alvo || !alvo.id) return;

            const slugBase = ((alvo.nome || alvo.email?.split('@')[0] || 'psicologo').replace(/[^a-zA-Z0-9_-]/g, '')) || `psi-${alvo.id.slice(0, 6)}`;
            const payload = {
                user_id: alvo.id,
                slug: document.getElementById('lpEditSlug')?.value?.trim() || slugBase,
                nome: document.getElementById('lpEditNome')?.value?.trim() || alvo.nome || 'Profissional',
                crp: document.getElementById('lpEditCrp')?.value?.trim() || alvo.crp || '',
                whatsapp: (document.getElementById('lpEditWhatsapp')?.value || '').replace(/\D/g, ''),
                subtitulo_topo: document.getElementById('lpEditSubtitulo')?.value?.trim() || (alvo.abordagem ? `Psicologia Clínica • ${alvo.abordagem}` : 'Psicologia Clínica'),
                badge_hero: document.getElementById('lpEditBadgeHero')?.value?.trim() || 'Atendimento Online e Individualizado',
                titulo_hero: document.getElementById('lpEditTituloHero')?.value?.trim() || 'Quem sou eu?',
                cor_500: document.getElementById('lpEditCor500')?.value || '#736185',
                cor_600: document.getElementById('lpEditCor600')?.value || '#5E4E6D',
                cor_700: document.getElementById('lpEditCor700')?.value || '#4A3D56',
                ativo: true
            };

            const { error } = await client
                .from('landing_pages')
                .upsert(payload, { onConflict: 'user_id' });

            if (error) {
                alert("Erro ao liberar Landing Page (verifique se o slug já está em uso): " + error.message);
                return;
            }

            alert(`Landing Page liberada com sucesso para ${alvo.nome || alvo.email}! Agora a aba já aparece no painel deste usuário.`);
            await carregarDadosMinhaLP();
            if (typeof carregarEquipe === 'function') carregarEquipe();
        }

        async function revogarLPAdmin() {
            if (!ehAdmin()) return;
            const alvo = obterUsuarioAlvoLP();
            if (!alvo || !alvo.id) return;

            const nomeAlvo = alvo.nome || alvo.email || 'este usuário';
            if (!confirm(`Deseja revogar o acesso à Landing Page de "${nomeAlvo}"?\n\nA aba "Minha Landing Page" deixará de aparecer para este usuário.`)) return;

            const { error } = await client
                .from('landing_pages')
                .delete()
                .eq('user_id', alvo.id);

            if (error) {
                alert("Erro ao revogar Landing Page: " + error.message);
                return;
            }

            alert(`Acesso à Landing Page revogado para ${nomeAlvo}.`);
            await carregarDadosMinhaLP();
            if (typeof carregarEquipe === 'function') carregarEquipe();
        }

        async function carregarDadosMinhaLP(pularPreparoFiltro = false) {
            if (!usuarioAtualPerfil || !usuarioAtualPerfil.id) return;

            if (ehAdmin() && !pularPreparoFiltro) {
                await prepararFiltroAdminLP();
            }

            const alvo = obterUsuarioAlvoLP();
            if (!alvo || !alvo.id) return;

            const fileInput = document.getElementById('lpEditFotoFile');
            if (fileInput) fileInput.value = '';

            const { data, error } = await client
                .from('landing_pages')
                .select('*')
                .eq('user_id', alvo.id)
                .maybeSingle();

            minhaLPAtual = data || null;
            const temLP = Boolean(data) || Boolean(alvo.tem_lp);
            atualizarBadgesAdminLP(temLP, alvo);

            const slugPadrao = data?.slug || (alvo.nome || 'psicologo').replace(/[^a-zA-Z0-9_-]/g, '');
            document.getElementById('lpEditSlug').value = slugPadrao;
            document.getElementById('lpEditNome').value = data?.nome || alvo.nome || '';
            document.getElementById('lpEditCrp').value = data?.crp || alvo.crp || '';
            document.getElementById('lpEditWhatsapp').value = data?.whatsapp || '';
            document.getElementById('lpEditSubtitulo').value = data?.subtitulo_topo || (alvo.abordagem ? `Psicologia Clínica • ${alvo.abordagem}` : '');
            document.getElementById('lpEditBadgeHero').value = data?.badge_hero || 'Atendimento Online e Individualizado';
            document.getElementById('lpEditTituloHero').value = data?.titulo_hero || 'Quem sou eu?';
            document.getElementById('lpEditSobreP1').value = data?.sobre_p1 || '';
            document.getElementById('lpEditSobreP2').value = data?.sobre_p2 || '';
            document.getElementById('lpEditSobreP3').value = data?.sobre_p3 || '';
            document.getElementById('lpEditCor500').value = data?.cor_500 || '#736185';
            document.getElementById('lpEditCor600').value = data?.cor_600 || '#5E4E6D';
            document.getElementById('lpEditCor700').value = data?.cor_700 || '#4A3D56';
            document.getElementById('lpEditAtivo').checked = data ? data.ativo !== false : true;

            const statusFoto = document.getElementById('lpStatusFoto');
            if (statusFoto) {
                statusFoto.textContent = data?.foto_url
                    ? "✓ Foto atual já publicada. Selecione outra se quiser trocar."
                    : "Nenhuma foto enviada ainda.";
            }

            atualizarPreviewLinkLP();
        }

        document.getElementById('formMinhaLP')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!usuarioAtualPerfil || !usuarioAtualPerfil.id) return;

            const alvo = obterUsuarioAlvoLP();
            if (!alvo || !alvo.id) return;

            const btn = document.getElementById('btnSalvarMinhaLP');
            const textoOriginal = btn.textContent;
            btn.disabled = true;
            btn.textContent = "Salvando...";

            let foto_url = minhaLPAtual?.foto_url || '';
            const fileInput = document.getElementById('lpEditFotoFile');
            const statusFoto = document.getElementById('lpStatusFoto');

            // Faz upload da foto profissional no bucket 'Assinaturas'
            if (fileInput && fileInput.files && fileInput.files[0]) {
                const file = fileInput.files[0];
                const fileExt = file.name.split('.').pop();
                const fileName = `lp-${alvo.id}-${Date.now()}.${fileExt}`;

                if (statusFoto) statusFoto.textContent = "Enviando foto...";

                const { error: uploadError } = await client.storage
                    .from('Assinaturas')
                    .upload(fileName, file, { upsert: true });

                if (uploadError) {
                    alert("Erro ao enviar foto: " + uploadError.message);
                    btn.disabled = false;
                    btn.textContent = textoOriginal;
                    return;
                }

                const { data: pubUrl } = client.storage.from('Assinaturas').getPublicUrl(fileName);
                foto_url = pubUrl.publicUrl;
            }

            const payload = {
                user_id: alvo.id,
                slug: document.getElementById('lpEditSlug').value.trim(),
                nome: document.getElementById('lpEditNome').value.trim(),
                crp: document.getElementById('lpEditCrp').value.trim(),
                whatsapp: document.getElementById('lpEditWhatsapp').value.replace(/\D/g, ''),
                subtitulo_topo: document.getElementById('lpEditSubtitulo').value.trim(),
                badge_hero: document.getElementById('lpEditBadgeHero').value.trim(),
                titulo_hero: document.getElementById('lpEditTituloHero').value.trim(),
                descricao_hero: document.getElementById('lpEditSobreP1').value.trim(),
                sobre_p1: document.getElementById('lpEditSobreP1').value.trim(),
                sobre_p2: document.getElementById('lpEditSobreP2').value.trim(),
                sobre_p3: document.getElementById('lpEditSobreP3').value.trim(),
                cor_500: document.getElementById('lpEditCor500').value,
                cor_600: document.getElementById('lpEditCor600').value,
                cor_700: document.getElementById('lpEditCor700').value,
                foto_url: foto_url,
                ativo: document.getElementById('lpEditAtivo').checked
            };

            const { data: salvo, error } = await client
                .from('landing_pages')
                .upsert(payload, { onConflict: 'user_id' })
                .select()
                .single();

            btn.disabled = false;
            btn.textContent = textoOriginal;

            if (error) {
                alert("Erro ao salvar Landing Page (verifique se este link/slug já não está em uso): " + error.message);
            } else {
                minhaLPAtual = salvo;
                if (statusFoto) statusFoto.textContent = "✓ Página e foto salvas com sucesso!";
                atualizarPreviewLinkLP();
                if (ehAdmin()) {
                    await prepararFiltroAdminLP();
                    atualizarBadgesAdminLP(true, alvo);
                    if (typeof carregarEquipe === 'function') carregarEquipe();
                }
                alert(ehAdmin() && alvo.id !== usuarioAtualPerfil.id
                    ? `Landing Page de ${alvo.nome || alvo.email} foi salva e liberada no ar!`
                    : "Sua Landing Page foi atualizada no ar!");
            }
        });
        
        function obterNomePsicologa(psicologaId) {
            if (!psicologaId) return 'Não atribuída';
            const u = todosUsuariosCache.find(user => user.id === psicologaId);
            if (!u) return 'Não atribuída';
            return u.nome || u.email || 'Sem nome';
        }

        function gerarUrlLembreteWhatsApp(pacienteId, dataHoraIso, modalidade) {
            const pac = todosPacientesCache.find(p => p.id === pacienteId) || {};
            const numLimpo = (pac.whatsapp || '').replace(/\D/g, '');
            if (!numLimpo) return null;

            const dt = new Date(dataHoraIso);
            const hora = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const hojeStr = obterChaveDiaLocal();
            const diaSessaoStr = obterChaveDiaLocal(new Date(dataHoraIso));
            const quando = diaSessaoStr === hojeStr ? 'hoje' : `no dia ${dt.toLocaleDateString('pt-BR')}`;

            let msg = `Olá ${pac.nome}, passando para confirmar nossa sessão ${quando} às ${hora}.`;
            if (modalidade === 'Online' && pac.link_sala && pac.link_sala.trim() !== '') {
                msg += ` Segue o link da sala: ${pac.link_sala.trim()}`;
            }
            return `https://wa.me/55${numLimpo}?text=${encodeURIComponent(msg)}`;
        }

        let notificacoesAtuaisCache = [];

        function alternarPainelNotificacoes() {
            const painel = document.getElementById('painelNotificacoes');
            if (painel) painel.classList.toggle('hidden');
        }

        function gerarNotificacoesInteligentes(pacientes, atendimentos, prontuarios) {
            const alertas = [];
            const agora = new Date();
            const hojeStr = obterChaveDiaLocal(agora);
            const amanhaObj = new Date(agora);
            amanhaObj.setDate(agora.getDate() + 1);
            const amanhaStr = obterChaveDiaLocal(amanhaObj);

            const clientesAtivos = pacientes.filter(p => p.status === 'Em Atendimento');
            const seteDiasAtras = new Date(agora);
            seteDiasAtras.setDate(agora.getDate() - 7);

            atendimentos.forEach(a => {
                if (!a.data_hora || a.status === 'Cancelada' || a.status === 'Falta') return;
                const dtSessao = new Date(a.data_hora);
                const jaPassou = dtSessao < agora && dtSessao >= seteDiasAtras;

                if (a.status === 'Realizada' || jaPassou) {
                    const temProntuarioApos = prontuarios.some(pr => {
                        if (pr.paciente_id !== a.paciente_id) return false;
                        const dtPront = new Date(pr.criado_em);
                        return dtPront >= new Date(dtSessao.getTime() - (2 * 60 * 60 * 1000));
                    });

                    if (!temProntuarioApos) {
                        const nomePac = a.pacientes ? a.pacientes.nome : 'Paciente';
                        const dataFormatada = dtSessao.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                        const horaFormatada = dtSessao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                        alertas.push({
                            icone: '📝',
                            titulo: `Prontuário pendente: ${nomePac}`,
                            descricao: `Sessão de ${dataFormatada} às ${horaFormatada} ainda não possui evolução registrada.`,
                            acaoHtml: `<button onclick="alternarPainelNotificacoes(); abrirDetalhesPaciente('${a.paciente_id}')" class="px-3 py-1.5 btn-plum rounded-xl text-[11px] font-semibold">Escrever prontuário</button>`
                        });
                    }
                }
            });

            notificacoesAtuaisCache = alertas;
            renderizarNotificacoesInteligentes();
        }

        function renderizarNotificacoesInteligentes() {
            const listaEl = document.getElementById('listaNotificacoesInteligentes');
            const badgeDesk = document.getElementById('badgeNotificacoesDesktop');
            const badgeMob = document.getElementById('badgeNotificacoesMobile');

            const qtd = notificacoesAtuaisCache.length;
            [badgeDesk, badgeMob].forEach(badge => {
                if (!badge) return;
                if (qtd > 0) {
                    badge.textContent = qtd > 9 ? '9+' : qtd;
                    badge.classList.remove('hidden');
                } else {
                    badge.classList.add('hidden');
                }
            });

            if (!listaEl) return;

            if (qtd === 0) {
                listaEl.innerHTML = `
                    <div class="py-10 text-center space-y-2">
                        <span class="text-2xl block">✨</span>
                        <p class="font-serif text-sm font-bold text-[#F3EEF6]">Tudo em dia!</p>
                        <p class="text-xs text-[#9C8EAD]">Nenhum prontuário pendente ou lembrete urgente no momento.</p>
                    </div>`;
                return;
            }

            listaEl.innerHTML = notificacoesAtuaisCache.map(n => `
                <div class="p-3.5 rounded-2xl bg-[#141019] border border-[#2E2538] space-y-2.5">
                    <div class="flex items-start gap-2.5">
                        <span class="text-base mt-0.5">${n.icone}</span>
                        <div class="flex-1 min-w-0">
                            <p class="text-xs font-bold text-[#F3EEF6]">${escapeHtml(n.titulo)}</p>
                            <p class="text-[11px] text-[#9C8EAD] mt-0.5 leading-relaxed">${escapeHtml(n.descricao)}</p>
                        </div>
                    </div>
                    <div class="flex justify-end">
                        ${n.acaoHtml}
                    </div>
                </div>
            `).join('');
        }

        function renderizarCronogramaHoje(atendimentos) {
            const container = document.getElementById('listaCronogramaHoje');
            const subtitulo = document.getElementById('subtituloHoje');
            const hojeStr = obterChaveDiaLocal();
            const deHoje = atendimentos.filter(a => a.data_hora && obterChaveDiaLocal(new Date(a.data_hora)) === hojeStr);

            document.getElementById('kpiSessoesHoje').textContent = deHoje.length;
            const realizadas = deHoje.filter(a => a.status === 'Realizada').length;
            document.getElementById('kpiSessoesRealizadas').textContent = `${realizadas} realizadas`;

            if (subtitulo) {
                subtitulo.textContent = deHoje.length 
                    ? `Você tem ${deHoje.length} ${deHoje.length === 1 ? 'sessão marcada' : 'sessões marcadas'} para hoje.` 
                    : 'Nenhuma sessão marcada para hoje.';
            }

            if (!container) return;
            if (deHoje.length === 0) {
                container.innerHTML = `
                    <div class="py-12 text-center text-[#9C8EAD]">
                        <span class="w-12 h-12 mx-auto mb-3 rounded-2xl bg-[#2B2138] text-[#C2ADC9] flex items-center justify-center text-xl">🗓️</span>
                        <p class="font-serif text-lg font-bold text-[#F3EEF6]">Dia livre</p>
                        <p class="text-xs text-[#9C8EAD] mt-1">Nenhum atendimento marcado para hoje.</p>
                    </div>`;
                return;
            }

            container.innerHTML = deHoje.map(a => {
                const hora = new Date(a.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const nome = a.pacientes ? a.pacientes.nome : 'Paciente';
                const iniciais = nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
                const modIcon = a.modalidade === 'Presencial' ? '📍 Presencial' : '🎥 Online';
                const pacObj = todosPacientesCache.find(p => p.id === a.paciente_id) || {};
                const linkValido = pacObj.link_sala && /^https?:\/\//i.test(pacObj.link_sala.trim());
                const linkSalaHtml = (a.modalidade !== 'Presencial' && linkValido)
                    ? ` · <a href="${escapeHtml(pacObj.link_sala.trim())}" target="_blank" rel="noopener noreferrer" class="text-purple-300 hover:underline font-semibold">Entrar na sala ↗</a>`
                    : '';
                const urlLembrete = gerarUrlLembreteWhatsApp(a.paciente_id, a.data_hora, a.modalidade);
                const btnLembrete = urlLembrete
                    ? `<a href="${urlLembrete}" target="_blank" title="Enviar lembrete no WhatsApp" class="px-2.5 py-1 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-xl text-[11px] font-semibold transition">💬 Lembrar</a>`
                    : '';

                return `
                    <div class="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-white/[0.03] transition">
                        <div class="flex items-center gap-3.5">
                            <span class="font-serif text-base font-bold text-[#C2ADC9]">${hora}</span>
                            <div class="w-8 h-8 rounded-full bg-[#2B2138] text-[#C2ADC9] font-bold text-xs flex items-center justify-center shrink-0">${iniciais}</div>
                            <div>
                                <p onclick="abrirDetalhesPaciente('${a.paciente_id}')" class="font-semibold text-xs text-[#F3EEF6] hover:underline cursor-pointer">${escapeHtml(nome)}</p>
                                <p class="text-[11px] text-[#9C8EAD]">${modIcon}${linkSalaHtml}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            ${btnLembrete}
                            <select onchange="atualizarStatusAtendimento('${a.id}', this.value)" class="text-xs input-dark rounded-xl px-2.5 py-1 font-semibold">
                                <option value="Agendada" ${a.status === 'Agendada' ? 'selected' : ''}>🕒 Agendada</option>
                                <option value="Confirmada" ${a.status === 'Confirmada' ? 'selected' : ''}>✅ Confirmada</option>
                                <option value="Realizada" ${a.status === 'Realizada' ? 'selected' : ''}>✔️ Realizada</option>
                                <option value="Falta" ${a.status === 'Falta' ? 'selected' : ''}>⚠️ Falta</option>
                                <option value="Cancelada" ${a.status === 'Cancelada' ? 'selected' : ''}>❌ Cancelada</option>
                            </select>
                            <button onclick="excluirSessao('${a.id}')" title="Excluir sessão" class="text-xs text-red-400 hover:text-red-300 p-1.5 hover:bg-red-500/15 rounded-lg">🗑️</button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function renderizarProximosEAlertas(atendimentos) {
            const containerProximos = document.getElementById('listaProximosDias');
            const hojeStr = obterChaveDiaLocal();
            const futuros = atendimentos.filter(a => a.data_hora && obterChaveDiaLocal(new Date(a.data_hora)) > hojeStr && a.status !== 'Cancelada').slice(0, 3);

            if (containerProximos) {
                if (futuros.length === 0) {
                    containerProximos.innerHTML = `<p class="text-xs text-[#9C8EAD]">Nenhuma sessão futura agendada.</p>`;
                } else {
                    containerProximos.innerHTML = futuros.map(a => {
                        const dt = new Date(a.data_hora);
                        const dia = dt.getDate();
                        const diaSemana = dt.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase().replace('.', '');
                        const hora = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                        const nome = a.pacientes ? a.pacientes.nome : 'Paciente';
                        return `
                            <div class="flex items-center gap-3 text-xs">
                                <div class="w-12 h-12 rounded-2xl bg-[#2B2138] text-white flex flex-col items-center justify-center shrink-0">
                                    <span class="text-[9px] font-bold text-[#9C8EAD] tracking-wider">${diaSemana}</span>
                                    <span class="text-base font-bold font-serif leading-none">${dia}</span>
                                </div>
                                <div class="truncate">
                                    <p class="font-bold text-[#F3EEF6] truncate">${escapeHtml(nome)}</p>
                                    <p class="text-[11px] text-[#9C8EAD] mt-0.5">${hora} · ${a.modalidade || 'Online'}</p>
                                </div>
                            </div>
                        `;
                    }).join('');
                }
            }
        }

        function mudarMes(delta) {
            dataCalendarioAtual.setMonth(dataCalendarioAtual.getMonth() + delta);
            renderizarCalendario();
        }

        function irParaHoje() {
            dataCalendarioAtual = new Date();
            diaSelecionadoAgendaIso = obterChaveDiaLocal();
            renderizarCalendario();
        }

        function renderizarCalendario() {
            const grid = document.getElementById('gridCalendario');
            const label = document.getElementById('labelMesAno');
            if (!grid || !label) return;

            const ano = dataCalendarioAtual.getFullYear();
            const mes = dataCalendarioAtual.getMonth();
            label.textContent = dataCalendarioAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

            const sessoesMes = todosAtendimentosCache.filter(a => {
                if (!a.data_hora) return false;
                const d = new Date(a.data_hora);
                return d.getFullYear() === ano && d.getMonth() === mes;
            });

            document.getElementById('mesTotalSessoes').textContent = sessoesMes.length;
            document.getElementById('mesRealizadas').textContent = sessoesMes.filter(s => s.status === 'Realizada').length;

            const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
            const totalDiasMes = new Date(ano, mes + 1, 0).getDate();
            const hojeStr = obterChaveDiaLocal();

            let html = '';
            for (let i = 0; i < primeiroDiaSemana; i++) {
                html += `<div class="min-h-[52px] sm:min-h-[75px] bg-[#141019]/60 rounded-xl sm:rounded-2xl border border-dashed border-[#2E2538]"></div>`;
            }

            for (let dia = 1; dia <= totalDiasMes; dia++) {
                const diaFormatado = String(dia).padStart(2, '0');
                const mesFormatado = String(mes + 1).padStart(2, '0');
                const dataDiaIso = `${ano}-${mesFormatado}-${diaFormatado}`;
                const ehHoje = dataDiaIso === hojeStr;
                const ehSelecionado = dataDiaIso === diaSelecionadoAgendaIso;

                const sessoesDia = todosAtendimentosCache.filter(a => a.data_hora && obterChaveDiaLocal(new Date(a.data_hora)) === dataDiaIso);

                html += `
                    <div onclick="selecionarDiaAgenda('${dataDiaIso}')" class="min-h-[52px] sm:min-h-[75px] p-1 sm:p-2 rounded-xl sm:rounded-2xl border cursor-pointer transition flex flex-col justify-between ${ehSelecionado ? 'border-[#8E73AD] bg-[#2B2138]' : (ehHoje ? 'border-[#5F4A78] bg-[#231B2E]' : 'border-[#2E2538] bg-[#141019] hover:border-[#5F4A78]')}">
                        <div class="flex justify-between items-center mb-0.5 sm:mb-1">
                            <span class="text-[11px] sm:text-xs font-bold ${ehHoje || ehSelecionado ? 'w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-[#8E73AD] text-white flex items-center justify-center text-[9px] sm:text-[10px]' : 'text-[#E5DCED]'}">${dia}</span>
                        </div>
                        <div class="space-y-0.5 sm:space-y-1 overflow-hidden pr-0.5">
                            ${sessoesDia.slice(0, 2).map(s => {
                                const hora = new Date(s.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                                const nome = s.pacientes ? s.pacientes.nome.split(' ')[0] : 'Sessão';
                                return `
                                    <div class="text-[8px] sm:text-[9px] px-0.5 sm:px-1 py-0.5 rounded bg-[#1D1724] border border-[#32283D] text-[#E5DCED] truncate font-medium">
                                        ${hora} ${escapeHtml(nome)}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }

            grid.innerHTML = html;
            renderizarDetalhesDiaAgenda();
        }

        function selecionarDiaAgenda(dataIso) {
            diaSelecionadoAgendaIso = dataIso;
            renderizarCalendario();
        }

        function renderizarDetalhesDiaAgenda() {
            const titulo = document.getElementById('detalheDiaTitulo');
            const corpo = document.getElementById('corpoDiaSelecionado');
            if (!titulo || !corpo) return;

            const [ano, mes, dia] = (diaSelecionadoAgendaIso || obterChaveDiaLocal()).split('-');
            const dataObj = new Date(ano, mes - 1, dia);

            titulo.textContent = dataObj.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
            const sessoesDoDia = todosAtendimentosCache.filter(a => a.data_hora && obterChaveDiaLocal(new Date(a.data_hora)) === diaSelecionadoAgendaIso);

            if (sessoesDoDia.length === 0) {
                corpo.innerHTML = `
                    <div class="py-8 text-center text-[#9C8EAD]">
                        <span class="w-10 h-10 mx-auto mb-2 rounded-full bg-[#2B2138] text-[#C2ADC9] flex items-center justify-center text-lg">🗓️</span>
                        <p class="font-serif font-bold text-sm text-[#F3EEF6]">Nenhuma sessão</p>
                        <p class="text-xs text-[#9C8EAD] mt-0.5 mb-4">Este dia está livre.</p>
                        <button onclick="abrirAgendamentoComData('${diaSelecionadoAgendaIso}')" class="px-4 py-2 btn-plum rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1.5 mx-auto">
                            <span>🗓️</span> Agendar neste dia
                        </button>
                    </div>
                `;
            } else {
                corpo.innerHTML = `
                    <div class="w-full space-y-2.5 text-left">
                        ${sessoesDoDia.map(s => {
                            const hora = new Date(s.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                            const nome = s.pacientes ? s.pacientes.nome : 'Paciente';
                            const urlLembrete = gerarUrlLembreteWhatsApp(s.paciente_id, s.data_hora, s.modalidade);
                            return `
                            <div class="p-3 bg-[#141019] rounded-xl border border-[#2E2538] space-y-2">
                                <div class="flex justify-between items-start gap-2">
                                    <div>
                                        <p class="font-bold text-xs text-[#F3EEF6]">${hora} - ${escapeHtml(nome)}</p>
                                        <p class="text-[10px] text-[#9C8EAD]">${s.modalidade || 'Online'}</p>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        ${urlLembrete ? `<a href="${urlLembrete}" target="_blank" title="Confirmar no WhatsApp" class="text-xs text-emerald-400 hover:underline font-semibold">💬</a>` : ''}
                                        <button onclick="abrirDetalhesPaciente('${s.paciente_id}')" class="text-xs text-[#C2ADC9] font-semibold hover:underline">Ficha</button>
                                        <button onclick="excluirSessao('${s.id}')" title="Excluir sessão" class="text-xs text-red-400 hover:text-red-300 p-1 hover:bg-red-500/15 rounded">🗑️</button>
                                    </div>
                                </div>
                                <div>
                                    <select onchange="atualizarStatusAtendimento('${s.id}', this.value)" class="w-full text-xs input-dark rounded-lg px-2.5 py-1.5 font-semibold outline-none">
                                        <option value="Agendada" ${s.status === 'Agendada' ? 'selected' : ''}>🕒 Agendada</option>
                                        <option value="Confirmada" ${s.status === 'Confirmada' ? 'selected' : ''}>✅ Confirmada</option>
                                        <option value="Realizada" ${s.status === 'Realizada' ? 'selected' : ''}>✔️ Realizada</option>
                                        <option value="Falta" ${s.status === 'Falta' ? 'selected' : ''}>⚠️ Falta</option>
                                        <option value="Cancelada" ${s.status === 'Cancelada' ? 'selected' : ''}>❌ Cancelada</option>
                                    </select>
                                </div>
                            </div>`;
                        }).join('')}
                        <button onclick="abrirAgendamentoComData('${diaSelecionadoAgendaIso}')" class="w-full mt-3 py-2 border border-[#32283D] text-xs font-semibold rounded-xl text-[#C2ADC9] hover:bg-[#2B2138]">+ Adicionar horário</button>
                    </div>
                `;
            }
        }

        function abrirAgendamentoComData(dataIso) {
            const hojeStr = obterChaveDiaLocal();
            if (dataIso < hojeStr) {
                alert("⚠️ Não é possível agendar sessões em datas passadas.");
                return;
            }
            mudarAba('agendar');
            const inputData = document.getElementById('agendarData');
            const inputHora = document.getElementById('agendarHora');
            if (inputData) {
                inputData.min = hojeStr;
                inputData.value = dataIso;
            }
            if (inputHora && !inputHora.value) inputHora.value = '14:00';
            atualizarResumoAgendamento();
        }

        function selecionarHorarioRapido(horaStr) {
            const inputHora = document.getElementById('agendarHora');
            if (inputHora) {
                inputHora.value = horaStr;
                atualizarResumoAgendamento();
            }
        }

        function montarDataLocalAgendamento() {
            const dataVal = document.getElementById('agendarData')?.value;
            const horaVal = document.getElementById('agendarHora')?.value;
            if (!dataVal || !horaVal) return null;

            const [ano, mes, dia] = dataVal.split('-').map(Number);
            const [hora, minuto] = horaVal.split(':').map(Number);
            return new Date(ano, mes - 1, dia, hora, minuto, 0, 0);
        }

        function formatarIsoComFusoLocal(dateObj, segundosExtras = 0) {
            const dt = segundosExtras ? new Date(dateObj.getTime() + segundosExtras * 1000) : dateObj;
            const pad = (n) => String(n).padStart(2, '0');
            const offsetMin = -dt.getTimezoneOffset();
            const sinal = offsetMin >= 0 ? '+' : '-';
            const absOffset = Math.abs(offsetMin);
            const offH = pad(Math.floor(absOffset / 60));
            const offM = pad(absOffset % 60);

            return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}${sinal}${offH}:${offM}`;
        }

        function obterChaveDataHoraMinutoLocal(dateObj) {
            const pad = (n) => String(n).padStart(2, '0');
            return `${obterChaveDiaLocal(dateObj)} ${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`;
        }

        function prepararTelaAgendamento(opcoes = {}) {
            const clientes = todosPacientesCache.filter(p => p.status !== 'Novo Contato');
            const select = document.getElementById('agendarClienteSelect');

            if (!select) return;

            const valorAnterior = select.value;

            if (clientes.length === 0) {
                select.innerHTML = '<option value="">Nenhum paciente cadastrado</option>';
                return;
            }

            const isAdmin = ehAdmin();
            select.innerHTML = clientes.map(c => {
                const sufixoPsi = isAdmin ? ` (${obterNomePsicologa(c.psicologa_id)})` : '';
                return `<option value="${c.id}">${escapeHtml(c.nome + sufixoPsi)}</option>`;
            }).join('');

            if (opcoes.preservarSelecao && valorAnterior && clientes.some(c => c.id === valorAnterior)) {
                select.value = valorAnterior;
            }

            const inputData = document.getElementById('agendarData');
            const inputHora = document.getElementById('agendarHora');
            const hojeStr = obterChaveDiaLocal();

            if (inputData) {
                inputData.min = hojeStr;
                if (!inputData.value || inputData.value < hojeStr) {
                    inputData.value = hojeStr;
                }
            }

            if (inputHora && !inputHora.value) {
                inputHora.value = '14:00';
            }

            if (!opcoes.preservarSelecao && typeof selecionarModalidade === 'function') {
                selecionarModalidade('Online');
            }
            if (typeof atualizarResumoAgendamento === 'function') {
                atualizarResumoAgendamento();
            }
        }

        function selecionarModalidade(mod) {
            modalidadeSelecionadaAgendamento = mod;
            const btnOnline = document.getElementById('btnModOnline');
            const btnPresencial = document.getElementById('btnModPresencial');
            if (mod === 'Online') {
                if (btnOnline) btnOnline.className = "py-2 border border-[#8E73AD] bg-[#2B2138] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5";
                if (btnPresencial) btnPresencial.className = "py-2 border border-[#32283D] text-[#9C8EAD] text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5";
            } else {
                if (btnOnline) btnOnline.className = "py-2 border border-[#32283D] text-[#9C8EAD] text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5";
                if (btnPresencial) btnPresencial.className = "py-2 border border-[#8E73AD] bg-[#2B2138] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5";
            }
            atualizarResumoAgendamento();
        }

        function alternarIsencao(isento) {
            const container = document.getElementById('campoValorContainer');
            const inputValor = document.getElementById('agendarValor');
            if (isento) {
                if (container) container.classList.add('opacity-40', 'pointer-events-none');
                if (inputValor) inputValor.value = 0;
            } else {
                if (container) container.classList.remove('opacity-40', 'pointer-events-none');
                if (inputValor) inputValor.value = 150;
            }
            atualizarResumoAgendamento();
        }

        function atualizarResumoAgendamento() {
            const freqEl = document.getElementById('agendarFrequencia');
            const contQtd = document.getElementById('containerQtdSessoes');
            if (freqEl && contQtd) {
                contQtd.classList.toggle('hidden', freqEl.value === 'unica');
            }
            const select = document.getElementById('agendarClienteSelect');
            if (!select || !select.value) return;

            const p = todosPacientesCache.find(item => item.id === select.value);
            if (!p) return;

            const rNome = document.getElementById('resumoNome');
            const rTel = document.getElementById('resumoTel');
            const rIniciais = document.getElementById('resumoIniciais');
            if (rNome) rNome.textContent = p.nome;
            if (rTel) rTel.textContent = p.whatsapp || 'Sem WhatsApp';
            if (rIniciais) rIniciais.textContent = p.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

            const dt = montarDataLocalAgendamento();
            if (dt && !isNaN(dt.getTime())) {
                const diaExt = dt.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
                const hora = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const rData = document.getElementById('resumoData');
                const rMod = document.getElementById('resumoModalidade');
                if (rData) rData.textContent = `${diaExt.charAt(0).toUpperCase() + diaExt.slice(1)}`;
                if (rMod) rMod.textContent = `às ${hora} · ${modalidadeSelecionadaAgendamento}`;
            }

            const isento = document.getElementById('agendarIsento')?.checked;
            const valor = isento ? 0 : (parseFloat(document.getElementById('agendarValor')?.value) || 0);
            const rVal = document.getElementById('resumoValor');
            if (rVal) rVal.textContent = formatarBRL(valor);
        }

        const formAgendamento = document.getElementById('formAgendamentoTela');
        if (formAgendamento) {
            formAgendamento.addEventListener('submit', async (e) => {
                e.preventDefault();
                const dataBase = montarDataLocalAgendamento();
                if (!dataBase || isNaN(dataBase.getTime())) {
                    alert("Selecione uma data e um horário válidos.");
                    return;
                }

                const agora = new Date();
                if (dataBase.getTime() < agora.getTime() - 60000) {
                    alert("⚠️ Não é possível agendar uma sessão para uma data ou horário que já passou!");
                    return;
                }

                const btn = document.getElementById('btnSalvarAgendamento');
                if (btn) { btn.disabled = true; btn.textContent = "Agendando..."; }

                const paciente_id = document.getElementById('agendarClienteSelect').value;
                const modalidade = modalidadeSelecionadaAgendamento;
                const isento = document.getElementById('agendarIsento')?.checked;
                const valor = isento ? 0 : (parseFloat(document.getElementById('agendarValor')?.value) || 0);

                const frequencia = document.getElementById('agendarFrequencia')?.value || 'unica';
                const qtdSessoes = frequencia === 'unica' ? 1 : (parseInt(document.getElementById('agendarQtdSessoes')?.value, 10) || 4);
                const diasIntervalo = frequencia === 'quinzenal' ? 14 : 7;

                try {
                    const datasParaCriar = [];
                    for (let i = 0; i < qtdSessoes; i++) {
                        const dt = new Date(dataBase);
                        dt.setDate(dataBase.getDate() + (i * diasIntervalo));
                        datasParaCriar.push(dt);
                    }

                    const pacienteAlvo = todosPacientesCache.find(p => p.id === paciente_id);
                    const psicologaAlvoId = pacienteAlvo?.psicologa_id || usuarioAtualPerfil?.id || null;

                    const { data: sessoesAtivas, error: erroConflito } = await client
                        .from('atendimentos')
                        .select('id, data_hora, paciente_id, status, pacientes(nome, psicologa_id)')
                        .is('excluido_em', null)
                        .neq('status', 'Cancelada');

                    if (erroConflito) throw erroConflito;

                    const chavesDesejadas = new Set(datasParaCriar.map(d => obterChaveDataHoraMinutoLocal(d)));
                    const conflitosMesmaPsicologa = (sessoesAtivas || []).filter(s => {
                        if (!s.data_hora) return false;
                        const chaveSessao = obterChaveDataHoraMinutoLocal(new Date(s.data_hora));
                        if (!chavesDesejadas.has(chaveSessao)) return false;

                        const psiDaSessao = s.pacientes?.psicologa_id
                            || todosPacientesCache.find(p => p.id === s.paciente_id)?.psicologa_id
                            || null;

                        return psiDaSessao === psicologaAlvoId;
                    });

                    if (conflitosMesmaPsicologa.length > 0) {
                        const dtConf = new Date(conflitosMesmaPsicologa[0].data_hora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                        const pacConf = conflitosMesmaPsicologa[0].pacientes ? conflitosMesmaPsicologa[0].pacientes.nome : 'outro paciente';
                        alert(`⚠️ Conflito de Horário!\nEste profissional já possui sessão em ${dtConf} com ${pacConf}. Ajuste a data/horário inicial.`);
                        if (btn) { btn.disabled = false; btn.textContent = "Confirmar agendamento"; }
                        return;
                    }

                    // Garante que mesmo se o banco tiver índice único legado em data_hora, diferentes psicólogas possam agendar no mesmo horário (HH:mm)
                    const timestampsOcupadosMs = new Set((sessoesAtivas || []).map(s => new Date(s.data_hora).getTime()));
                    const novosAtendimentos = datasParaCriar.map(dt => {
                        let segOffset = 0;
                        while (timestampsOcupadosMs.has(dt.getTime() + segOffset * 1000) && segOffset < 59) {
                            segOffset++;
                        }
                        timestampsOcupadosMs.add(dt.getTime() + segOffset * 1000);
                        return {
                            paciente_id,
                            data_hora: formatarIsoComFusoLocal(dt, segOffset),
                            modalidade,
                            status: 'Agendada'
                        };
                    });

                    const { error: erroAtend } = await client.from('atendimentos').insert(novosAtendimentos);
                    if (erroAtend) throw erroAtend;

                    const novosPagamentos = datasParaCriar.map(dt => {
                        const venc = obterChaveDiaLocal(dt);
                        return {
                            paciente_id,
                            valor,
                            data_vencimento: venc,
                            status: isento ? 'Pago' : 'Pendente',
                            data_pagamento: isento ? venc : null
                        };
                    });

                    await client.from('pagamentos').insert(novosPagamentos);

                    await carregarDados();
                    mudarAba('agenda');
                } catch (err) {
                    alert("Erro ao agendar: " + err.message);
                } finally {
                    if (btn) { btn.disabled = false; btn.textContent = "Confirmar agendamento"; }
                }
            });
        }

        function filtrarStatusCliente(status) {
            filtroClienteAtivo = status;
            ['todos', 'atendimento', 'pausado', 'alta'].forEach(f => {
                const el = document.getElementById(`filter-${f}`);
                if (el) el.className = "px-3 py-1.5 rounded-xl text-[#9C8EAD] hover:text-white";
            });

            if (status === 'Todos') document.getElementById('filter-todos').className = "px-3 py-1.5 rounded-xl bg-[#2B2138] text-white shadow-sm";
            if (status === 'Em Atendimento') document.getElementById('filter-atendimento').className = "px-3 py-1.5 rounded-xl bg-[#2B2138] text-white shadow-sm";
            if (status === 'Pausado') document.getElementById('filter-pausado').className = "px-3 py-1.5 rounded-xl bg-[#2B2138] text-white shadow-sm";
            if (status === 'Alta') document.getElementById('filter-alta').className = "px-3 py-1.5 rounded-xl bg-[#2B2138] text-white shadow-sm";

            aplicarFiltrosClientes();
        }

        function aplicarFiltrosClientes() {
            const busca = (document.getElementById('buscaCliente').value || '').toLowerCase();
            const clientes = todosPacientesCache.filter(p => p.status !== 'Novo Contato');

            document.getElementById('count-todos').textContent = clientes.length;
            document.getElementById('count-atendimento').textContent = clientes.filter(c => c.status === 'Em Atendimento').length;
            document.getElementById('count-pausado').textContent = clientes.filter(c => c.status === 'Pausado').length;
            document.getElementById('count-alta').textContent = clientes.filter(c => c.status === 'Alta').length;

            const filtrados = clientes.filter(c => {
                const matchStatus = filtroClienteAtivo === 'Todos' || c.status === filtroClienteAtivo;
                const matchBusca = c.nome.toLowerCase().includes(busca) || (c.whatsapp || '').includes(busca);
                return matchStatus && matchBusca;
            });

            const tbody = document.getElementById('tabelaClientes');
            const cardsMobile = document.getElementById('listaCardsClientesMobile');
            const isAdmin = ehAdmin();

            if (filtrados.length === 0) {
                const cols = isAdmin ? 8 : 7;
                if (tbody) tbody.innerHTML = `<tr><td colspan="${cols}" class="p-6 text-center text-[#9C8EAD]">Nenhum paciente localizado.</td></tr>`;
                if (cardsMobile) cardsMobile.innerHTML = `<div class="card-surface p-6 text-center text-xs text-[#9C8EAD]">Nenhum paciente localizado.</div>`;
                return;
            }

            if (tbody) {
                tbody.innerHTML = filtrados.map(c => {
                    const iniciais = c.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
                    const finStatus = c.status_financeiro || 'Em dia';
                    const finClass = finStatus === 'Em dia' 
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                        : (finStatus === 'Promessa de Pagamento' ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30');
                    const statusPill = c.status === 'Em Atendimento' 
                        ? 'bg-emerald-500/15 text-emerald-400' 
                        : 'bg-[#2B2138] text-[#C2ADC9]';
                    const dataCadastro = c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '—';

                    const colunaPsicologa = isAdmin ? `
                        <td class="p-4" onclick="event.stopPropagation()">
                            <select onchange="alterarPsicologaPaciente('${c.id}', this.value)" class="text-xs input-dark rounded-xl px-2 py-1 font-medium outline-none">
                                <option value="">Sem vínculo</option>
                                ${todosUsuariosCache.map(u => `
                                    <option value="${u.id}" ${c.psicologa_id === u.id ? 'selected' : ''}>${escapeHtml(u.nome || u.email)}</option>
                                `).join('')}
                            </select>
                        </td>
                    ` : '';

                    return `
                        <tr class="hover:bg-white/[0.03] cursor-pointer" onclick="abrirDetalhesPaciente('${c.id}')">
                            <td class="p-4 flex items-center gap-3">
                                <div class="w-8 h-8 rounded-full bg-[#2B2138] text-[#C2ADC9] font-bold text-xs flex items-center justify-center shrink-0">${iniciais}</div>
                                <div>
                                    <p class="font-bold text-xs text-[#F3EEF6] hover:underline">${escapeHtml(c.nome)}</p>
                                    <p class="text-[11px] text-[#9C8EAD]">${c.modalidade || 'Online'} · Cad: ${dataCadastro}</p>
                                </div>
                            </td>
                            ${colunaPsicologa}
                            <td class="p-4 text-xs text-[#E5DCED]">
                                <span>💬</span> ${escapeHtml(c.whatsapp || '-')}
                            </td>
                            <td class="p-4 text-xs text-[#9C8EAD]">
                                ${c.data_nascimento ? new Date(c.data_nascimento + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                            </td>
                            <td class="p-4 text-xs font-semibold text-white">${formatarBRL(c.valor_padrao_sessao || 150)}</td>
                            <td class="p-4">
                                <span class="px-2.5 py-1 rounded-full text-[11px] font-semibold ${finClass}">● ${finStatus}</span>
                            </td>
                            <td class="p-4" onclick="event.stopPropagation()">
                                <select onchange="atualizarStatusPaciente('${c.id}', this.value)" class="text-xs px-2.5 py-1 rounded-full font-semibold border-0 outline-none cursor-pointer ${statusPill}">
                                    <option value="Em Atendimento" ${c.status === 'Em Atendimento' ? 'selected' : ''}>Em Atendimento</option>
                                    <option value="Pausado" ${c.status === 'Pausado' ? 'selected' : ''}>Pausado</option>
                                    <option value="Alta" ${c.status === 'Alta' ? 'selected' : ''}>Alta</option>
                                </select>
                            </td>
                            <td class="p-4 text-center" onclick="event.stopPropagation()">
                                <button onclick="excluirPaciente('${c.id}')" title="Excluir paciente" class="text-red-400 hover:text-red-300 p-1.5 hover:bg-red-500/15 rounded-lg transition">🗑️</button>
                            </td>
                        </tr>
                    `;
                }).join('');
            }

            if (cardsMobile) {
                cardsMobile.innerHTML = filtrados.map(c => {
                    const iniciais = c.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
                    const finStatus = c.status_financeiro || 'Em dia';
                    const finClass = finStatus === 'Em dia' ? 'bg-emerald-500/15 text-emerald-400' : (finStatus === 'Promessa de Pagamento' ? 'bg-amber-500/15 text-amber-300' : 'bg-red-500/15 text-red-400');
                    const infoPsicologaMobile = isAdmin ? `<p class="text-[10px] text-purple-300 font-semibold mt-0.5">Psi: ${escapeHtml(obterNomePsicologa(c.psicologa_id))}</p>` : '';

                    return `
                        <div onclick="abrirDetalhesPaciente('${c.id}')" class="card-surface p-4 flex flex-col gap-2.5 cursor-pointer active:scale-[0.99] transition">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2.5">
                                    <div class="w-9 h-9 rounded-full bg-[#2B2138] text-[#C2ADC9] font-bold text-xs flex items-center justify-center shrink-0">${iniciais}</div>
                                    <div>
                                        <h4 class="font-bold text-xs text-[#F3EEF6]">${escapeHtml(c.nome)}</h4>
                                        <p class="text-[11px] text-[#9C8EAD]">${c.modalidade || 'Online'} · ${formatarBRL(c.valor_padrao_sessao || 150)}</p>
                                        ${infoPsicologaMobile}
                                    </div>
                                </div>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold ${finClass}">● ${finStatus}</span>
                            </div>
                            <div class="flex items-center justify-between pt-2 border-t border-[#2E2538] text-xs text-[#9C8EAD]">
                                <span>💬 ${escapeHtml(c.whatsapp || '-')}</span>
                                <span class="font-semibold text-[#C2ADC9]">Abrir Prontuário ›</span>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        async function alterarPsicologaPaciente(pacienteId, novaPsicologaId) {
            const { error } = await client
                .from('pacientes')
                .update({ psicologa_id: novaPsicologaId || null })
                .eq('id', pacienteId);

            if (error) {
                alert("Erro ao vincular psicóloga: " + error.message);
            } else {
                await carregarDados();
            }
        }

        async function excluirPaciente(pacienteId, nomeFallback = '') {
            const pacObj = todosPacientesCache.find(item => item.id === pacienteId);
            const nomePaciente = pacObj ? pacObj.nome : (nomeFallback || 'este paciente');
            if (!confirm(`Tem certeza que deseja excluir o paciente "${nomePaciente}"?\n\nIsso removerá também todo o histórico de prontuários, sessões e cobranças vinculados a ele.`)) {
                return;
            }

            const agoraIso = new Date().toISOString();
            const { error } = await client
                .from('pacientes')
                .update({ excluido_em: agoraIso })
                .eq('id', pacienteId);
            if (error) {
                alert("Erro ao excluir paciente: " + error.message);
            } else {
                if (pacienteSelecionadoId === pacienteId) {
                    fecharDetalhesPaciente();
                }
                await carregarDados();
            }
        }

        function excluirPacienteAtual() {
            if (!pacienteSelecionadoId) return;
            const p = todosPacientesCache.find(item => item.id === pacienteSelecionadoId);
            excluirPaciente(pacienteSelecionadoId, p ? p.nome : 'este paciente');
        }

        async function abrirDetalhesPaciente(id) {
            const p = todosPacientesCache.find(item => item.id === id);
            if (!p) return;
            pacienteSelecionadoId = id;

            document.getElementById('detalheNome').textContent = p.nome;
            document.getElementById('detalheTelefone').textContent = p.whatsapp ? `WhatsApp: ${p.whatsapp}` : "Sem WhatsApp";
            
            const btnWpp = document.getElementById('btnWhatsappDrawer');
            const numLimpo = (p.whatsapp || '').replace(/\D/g, '');
            const meuNome = obterNomeExibicaoUsuario();
            if (numLimpo && btnWpp) {
                const msgWpp = encodeURIComponent(`Olá, ${p.nome}! Tudo bem? Aqui é ${meuNome}.`);
                btnWpp.href = `https://wa.me/55${numLimpo}?text=${msgWpp}`;
                btnWpp.classList.remove('hidden');
            } else if (btnWpp) {
                btnWpp.classList.add('hidden');
            }

            document.getElementById('detalheAvatar').textContent = p.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
            document.getElementById('editPacienteWhatsapp').value = p.whatsapp || '';
            document.getElementById('editPacienteNascimento').value = p.data_nascimento || '';
            document.getElementById('editPacienteCpf').value = p.cpf || '';
            document.getElementById('editResponsavelNome').value = p.responsavel_nome || '';
            document.getElementById('editResponsavelCpf').value = p.responsavel_cpf || '';
            document.getElementById('editPacienteLinkSala').value = p.link_sala || '';
            const lgpdEl = document.getElementById('statusLgpdDrawer');
            const btnLgpd = document.getElementById('btnRegistrarLgpdDrawer');
            if (lgpdEl) {
                if (p.lgpd_aceito_em) {
                    const dtLgpd = new Date(p.lgpd_aceito_em).toLocaleString('pt-BR');
                    lgpdEl.textContent = `✓ Consentimento LGPD registrado em ${dtLgpd}`;
                    lgpdEl.className = "text-[10px] text-emerald-400";
                    if (btnLgpd) btnLgpd.classList.add('hidden');
                } else {
                    lgpdEl.textContent = "⚠️ Consentimento LGPD pendente de registro";
                    lgpdEl.className = "text-[10px] text-amber-400";
                    if (btnLgpd) btnLgpd.classList.remove('hidden');
                }
            }
            document.getElementById('editPacienteAbordagem').value = p.abordagem || (usuarioAtualPerfil ? (usuarioAtualPerfil.abordagem || '') : '');
            document.getElementById('detalheStatusFinanceiro').value = p.status_financeiro || 'Em dia';

            const containerPsi = document.getElementById('containerEditPsicologaDrawer');
            const selectPsi = document.getElementById('editPacientePsicologa');
            if (ehAdmin() && containerPsi && selectPsi) {
                containerPsi.classList.remove('hidden');
                selectPsi.innerHTML = `<option value="">Sem vínculo</option>` + todosUsuariosCache.map(u => `
                    <option value="${u.id}" ${p.psicologa_id === u.id ? 'selected' : ''}>${escapeHtml(u.nome || u.email)}</option>
                `).join('');
            } else if (containerPsi) {
                containerPsi.classList.add('hidden');
            }
            
            const campoNovoTexto = document.getElementById('textoNovoProntuario');
            if (campoNovoTexto) campoNovoTexto.value = '';

            await carregarHistoricoProntuarios(id);
            renderizarSessoesDoPacienteNaFicha(id);

            const SpeechRecSuportado = window.SpeechRecognition || window.webkitSpeechRecognition;
            const btnVoz = document.getElementById('btnVozDrawer');
            if (btnVoz) {
                if (!SpeechRecSuportado) {
                    btnVoz.disabled = true;
                    btnVoz.className = "px-3 py-1.5 bg-[#141019] border border-[#2E2538] text-[#9C8EAD] text-[11px] rounded-xl cursor-not-allowed";
                    btnVoz.innerHTML = "🎙️ Voz disponível no Chrome/Safari";
                } else {
                    btnVoz.disabled = false;
                    btnVoz.className = "px-3.5 py-1.5 btn-plum text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm";
                    btnVoz.innerHTML = '<span id="iconeMicDrawer">🎙️</span> <span id="textoMicDrawer">Gravar Voz</span>';
                }
            }
            document.getElementById('drawerPaciente').classList.remove('hidden');
        }

        async function registrarConsentimentoLgpdManual() {
            if (!pacienteSelecionadoId) return;
            if (!confirm("Confirma que a(o) paciente ou responsável concedeu consentimento para o tratamento de dados clínicos (LGPD / CFP)?")) return;

            const agoraIso = new Date().toISOString();
            const { error } = await client
                .from('pacientes')
                .update({ lgpd_aceito: true, lgpd_aceito_em: agoraIso })
                .eq('id', pacienteSelecionadoId);

            if (error) {
                alert("Erro ao registrar consentimento: " + error.message);
            } else {
                await carregarDados();
                await abrirDetalhesPaciente(pacienteSelecionadoId);
            }
        }

        function fecharDetalhesPaciente() {
            if (gravando) alternarGravacaoVoz();
            document.getElementById('drawerPaciente').classList.add('hidden');
        }

        function renderizarSessoesDoPacienteNaFicha(pacienteId) {
            const container = document.getElementById('listaSessoesPacienteDrawer');
            const badge = document.getElementById('contadorSessoesPaciente');
            if (!container) return;

            const sessoes = todosAtendimentosCache
                .filter(a => a.paciente_id === pacienteId)
                .sort((a, b) => new Date(b.data_hora) - new Date(a.data_hora));

            if (badge) badge.textContent = sessoes.length;

            if (sessoes.length === 0) {
                container.innerHTML = `<p class="text-[11px] text-[#9C8EAD] italic py-2">Nenhuma sessão registrada para este paciente.</p>`;
                return;
            }

            container.innerHTML = sessoes.map(s => {
                const dt = new Date(s.data_hora);
                const dataStr = dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
                const horaStr = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                return `
                    <div class="p-2.5 bg-[#141019] rounded-xl border border-[#2E2538] flex items-center justify-between gap-2">
                        <div>
                            <p class="font-bold text-[#F3EEF6]">${dataStr} · ${horaStr}</p>
                            <p class="text-[10px] text-[#9C8EAD]">${s.modalidade || 'Online'}</p>
                        </div>
                        <select onchange="atualizarStatusAtendimento('${s.id}', this.value)" class="text-[11px] input-dark rounded-lg px-2 py-1 font-semibold outline-none">
                            <option value="Agendada" ${s.status === 'Agendada' ? 'selected' : ''}>🕒 Agendada</option>
                            <option value="Confirmada" ${s.status === 'Confirmada' ? 'selected' : ''}>✅ Confirmada</option>
                            <option value="Realizada" ${s.status === 'Realizada' ? 'selected' : ''}>✔️ Realizada</option>
                            <option value="Falta" ${s.status === 'Falta' ? 'selected' : ''}>⚠️ Falta</option>
                            <option value="Cancelada" ${s.status === 'Cancelada' ? 'selected' : ''}>❌ Cancelada</option>
                        </select>
                    </div>
                `;
            }).join('');
        }
            
        let historicoProntuarioAtualCache = [];

        async function carregarHistoricoProntuarios(pacienteId) {
            const container = document.getElementById('listaHistoricoProntuarios');
            const campoBusca = document.getElementById('buscaProntuarioInterno');
            if (campoBusca) campoBusca.value = '';
            if (!container) return;

            container.innerHTML = `<p class="text-xs text-[#9C8EAD]">Carregando prontuários antigos...</p>`;

            const { data: historico, error } = await client
                .from('prontuarios_historico')
                .select('*')
                .eq('paciente_id', pacienteId)
                .is('excluido_em', null)
                .order('criado_em', { ascending: false });

            if (error || !historico || historico.length === 0) {
                historicoProntuarioAtualCache = [];
                atualizarContadorSelecaoEvolucoes();
                container.innerHTML = `
                    <div class="p-6 bg-[#141019] rounded-2xl border border-dashed border-[#2E2538] text-center text-xs text-[#9C8EAD]">
                        Nenhum prontuário anterior gravado para este paciente.
                    </div>`;
                return;
            }

            historicoProntuarioAtualCache = historico;
            renderizarListaProntuariosFiltrada(historico);
        }

        function filtrarHistoricoProntuarios() {
            const termo = (document.getElementById('buscaProntuarioInterno')?.value || '').toLowerCase().trim();
            if (!termo) {
                renderizarListaProntuariosFiltrada(historicoProntuarioAtualCache);
                return;
            }
            const filtrados = historicoProntuarioAtualCache.filter(reg => {
                const dataStr = new Date(reg.criado_em).toLocaleDateString('pt-BR');
                return (reg.conteudo || '').toLowerCase().includes(termo) || dataStr.includes(termo);
            });
            renderizarListaProntuariosFiltrada(filtrados);
        }

        function renderizarListaProntuariosFiltrada(lista) {
            const container = document.getElementById('listaHistoricoProntuarios');
            if (!container) return;

            if (lista.length === 0) {
                container.innerHTML = `<div class="p-4 text-center text-xs text-[#9C8EAD]">Nenhuma evolução encontrada com esse termo.</div>`;
                return;
            }

            container.innerHTML = lista.map((reg, index) => {
                const indexOriginal = historicoProntuarioAtualCache.findIndex(item => item.id === reg.id);
                const numeroRegistro = historicoProntuarioAtualCache.length - indexOriginal;
                const dataReg = new Date(reg.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const horaReg = new Date(reg.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const textoLongo = (reg.conteudo || '').length > 260;
                const comecaRecolhido = index > 0 && textoLongo;

                const btnExcluirAudit = ehAdmin()
                    ? `<button onclick="excluirProntuario('${reg.id}')" title="Remover registro (Admin)" class="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/15 rounded-lg transition text-xs">🗑️</button>`
                    : '';

                return `
                    <div class="p-4 bg-[#141019] rounded-2xl border border-[#2E2538] space-y-2 transition hover:border-[#3F3152]">
                        <div class="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#9C8EAD]">
                            <label class="flex items-center gap-2.5 cursor-pointer font-bold text-[#C2ADC9]">
                                <input type="checkbox" value="${reg.id}" onchange="atualizarContadorSelecaoEvolucoes()" class="chk-evolucao-pdf accent-[#8E73AD] w-4 h-4 rounded">
                                <span>🔒 Registro #${numeroRegistro} · ${dataReg} às ${horaReg}</span>
                            </label>
                            <div class="flex items-center gap-2">
                                <button type="button" onclick="exportarProntuarioPDF('${reg.id}')" title="Exportar somente esta evolução em PDF" class="px-2.5 py-1 bg-[#2B2138] hover:bg-[#3F3152] border border-[#5F4A78] text-[#E9DDF5] rounded-lg text-[11px] font-semibold transition">
                                    📄 Só esta
                                </button>
                                <span class="text-[10px] bg-[#1D1724] px-2.5 py-1 rounded-lg border border-[#32283D] font-medium">${escapeHtml(reg.autor_email || 'Psicologia')}</span>
                                ${btnExcluirAudit}
                            </div>
                        </div>
                        <p id="textoEvo_${reg.id}" class="text-xs sm:text-sm text-[#E5DCED] whitespace-pre-wrap leading-relaxed pl-6 ${comecaRecolhido ? 'line-clamp-3' : ''}">${escapeHtml(reg.conteudo)}</p>
                        ${textoLongo ? `
                            <div class="pl-6">
                                <button type="button" onclick="alternarExpandirEvolucao('${reg.id}', this)" class="text-[11px] font-semibold text-[#C2ADC9] hover:text-white hover:underline">
                                    ${comecaRecolhido ? 'Ler registro completo ▾' : 'Recolher texto ▴'}
                                </button>
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');

            atualizarContadorSelecaoEvolucoes();
        }

        function alternarExpandirEvolucao(id, btn) {
            const p = document.getElementById(`textoEvo_${id}`);
            if (!p) return;
            const recolhido = p.classList.toggle('line-clamp-3');
            btn.textContent = recolhido ? 'Ler registro completo ▾' : 'Recolher texto ▴';
        }

        function atualizarContadorSelecaoEvolucoes() {
            const marcados = document.querySelectorAll('.chk-evolucao-pdf:checked').length;
            const span = document.getElementById('contadorEvolucoesSelecionadas');
            const btnTodas = document.getElementById('btnToggleSelecionarTodas');
            const total = document.querySelectorAll('.chk-evolucao-pdf').length;

            if (span) {
                span.textContent = marcados > 0 ? `(${marcados} ${marcados === 1 ? 'selecionada' : 'selecionadas'})` : '(Todas)';
            }
            if (btnTodas) {
                btnTodas.textContent = (total > 0 && marcados === total) ? '⬜ Desmarcar' : '☑️ Marcar todas';
            }
        }

        function alternarSelecionarTodasEvolucoes() {
            const checkboxes = document.querySelectorAll('.chk-evolucao-pdf');
            const todosMarcados = Array.from(checkboxes).every(cb => cb.checked);
            checkboxes.forEach(cb => { cb.checked = !todosMarcados; });
            atualizarContadorSelecaoEvolucoes();
        }

        async function excluirProntuario(prontuarioId) {
            if (!confirm("Tem certeza que deseja excluir esta anotação do prontuário? Esta ação não pode ser desfeita.")) {
                return;
            }

            const { error } = await client
                .from('prontuarios_historico')
                .update({ excluido_em: new Date().toISOString() })
                .eq('id', prontuarioId);

            if (error) {
                alert("Erro ao excluir prontuário: " + error.message);
            } else if (pacienteSelecionadoId) {
                await carregarHistoricoProntuarios(pacienteSelecionadoId);
            }
        }

        async function salvarNovaEvolucaoEAtualizar() {
            if (!pacienteSelecionadoId) return;

            const btn = document.getElementById('btnSalvarProntuario');
            if (btn) {
                btn.disabled = true;
                btn.textContent = "Salvando...";
            }

            const inputNovoTexto = document.getElementById('textoNovoProntuario');
            const novoTexto = inputNovoTexto ? inputNovoTexto.value.trim() : '';
            const whatsapp = document.getElementById('editPacienteWhatsapp').value.trim();
            const data_nascimento = document.getElementById('editPacienteNascimento').value || null;
            const status_financeiro = document.getElementById('detalheStatusFinanceiro').value;

            const updatePayload = {
                whatsapp,
                data_nascimento,
                link_sala: document.getElementById('editPacienteLinkSala').value.trim() || null,
                cpf: document.getElementById('editPacienteCpf').value.trim() || null,
                responsavel_nome: document.getElementById('editResponsavelNome').value.trim() || null,
                responsavel_cpf: document.getElementById('editResponsavelCpf').value.trim() || null,
                status_financeiro,
                abordagem: document.getElementById('editPacienteAbordagem').value.trim() || null,
            };

            if (ehAdmin()) {
                const selectPsi = document.getElementById('editPacientePsicologa');
                if (selectPsi) updatePayload.psicologa_id = selectPsi.value || null;
            }

            try {
                await client.from('pacientes').update(updatePayload).eq('id', pacienteSelecionadoId);

                if (novoTexto.length > 0) {
                    const autorNome = obterNomeExibicaoUsuario();

                    const { error: erroHist } = await client.from('prontuarios_historico').insert([{
                        paciente_id: pacienteSelecionadoId,
                        conteudo: novoTexto,
                        autor_email: autorNome
                    }]);

                    if (erroHist) throw erroHist;
                    if (inputNovoTexto) inputNovoTexto.value = '';
                }

                await carregarDados();
                await carregarHistoricoProntuarios(pacienteSelecionadoId);
                renderizarSessoesDoPacienteNaFicha(pacienteSelecionadoId);

                document.getElementById('detalheTelefone').textContent = whatsapp ? `WhatsApp: ${whatsapp}` : "Sem WhatsApp";
                alert("Prontuário salvo com sucesso!");
            } catch (err) {
                alert("Erro ao salvar: " + err.message);
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = "Salvar Evolução";
                }
            }
        }

        function abrirModalCliente() {
            const containerPsi = document.getElementById('containerSelectPsicologaNovoPaciente');
            const selectPsi = document.getElementById('clientePsicologaSelect');
            if (ehAdmin() && containerPsi && selectPsi) {
                containerPsi.classList.remove('hidden');
                selectPsi.innerHTML = todosUsuariosCache.map(u => `
                    <option value="${u.id}" ${u.id === usuarioAtualPerfil.id ? 'selected' : ''}>${escapeHtml(u.nome || u.email)}</option>
                `).join('');
            } else if (containerPsi) {
                containerPsi.classList.add('hidden');
            }
            document.getElementById('modalCliente').classList.remove('hidden');
        }

        document.getElementById('formNovoCliente').addEventListener('submit', async (e) => {
            e.preventDefault();
            const nome = document.getElementById('clienteNome').value.trim();
            const whatsapp = document.getElementById('clienteWhatsapp').value.trim();
            const cpf = document.getElementById('clienteCpf').value.trim() || null;
            const data_nascimento = document.getElementById('clienteDataNascimento').value || null;
            const modalidade = document.getElementById('clienteModalidade').value;
            const valor = parseFloat(document.getElementById('clienteValor').value) || 150.00;
            const responsavel_nome = document.getElementById('clienteResponsavelNome').value.trim() || null;
            const responsavel_cpf = document.getElementById('clienteResponsavelCpf').value.trim() || null;

            let psicologa_id = usuarioAtualPerfil ? usuarioAtualPerfil.id : null;
            if (ehAdmin()) {
                const selectPsi = document.getElementById('clientePsicologaSelect');
                if (selectPsi && selectPsi.value) psicologa_id = selectPsi.value;
            }

            const lgpdAceito = document.getElementById('clienteLgpdCheck').checked;
            const { error } = await client.from('pacientes').insert([{
                nome,
                whatsapp,
                cpf,
                data_nascimento,
                modalidade,
                valor_padrao_sessao: valor,
                responsavel_nome,
                responsavel_cpf,
                lgpd_aceito: lgpdAceito,
                lgpd_aceito_em: lgpdAceito ? new Date().toISOString() : null,
                status: 'Em Atendimento',
                status_financeiro: 'Em dia',
                psicologa_id
            }]);

            if (error) return alert("Erro ao criar paciente: " + error.message);

            document.getElementById('formNovoCliente').reset();
            fecharModal('modalCliente');
            await carregarDados();
        });

        async function carregarEquipe() {
            if (!ehAdmin()) return;
            const tbody = document.getElementById('tabelaUsuarios');
            if (!tbody) return;

            tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-[#9C8EAD]">Carregando equipe...</td></tr>`;

            const [{ data: usuarios, error }, { data: lps }] = await Promise.all([
                client.from('usuarios_perfis').select('*').order('created_at', { ascending: false }),
                client.from('landing_pages').select('id, user_id, slug, ativo')
            ]);

            if (error) {
                tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-400">Erro ao carregar equipe: ${escapeHtml(error.message)}</td></tr>`;
                return;
            }

            todosUsuariosCache = usuarios || [];
            todasLPsCache = lps || [];
            const idsComLP = new Set(todasLPsCache.map(item => item.user_id));

            if (todosUsuariosCache.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-[#9C8EAD]">Nenhum usuário encontrado na tabela usuarios_perfis.</td></tr>`;
                return;
            }

            tbody.innerHTML = todosUsuariosCache.map(u => {
                const isAdmin = u.role === 'admin';
                const temLP = idsComLP.has(u.id) || Boolean(u.tem_lp);
                const nomeAtual = u.nome || (u.email ? u.email.split('@')[0] : 'Sem nome');
                return `
                    <tr class="hover:bg-white/[0.03]">
                        <td class="p-4">
                            <div class="flex items-center gap-2">
                                <input type="text" value="${escapeHtml(nomeAtual)}" id="nomeUser_${u.id}" class="text-xs font-bold input-dark rounded-lg px-2.5 py-1 outline-none">
                                <button type="button" onclick="salvarNomeUsuarioEquipe('${u.id}')" class="px-2.5 py-1 bg-[#2B2138] text-[#C2ADC9] hover:bg-[#8E73AD] hover:text-white rounded-lg text-[11px] font-semibold transition">Salvar</button>
                            </div>
                        </td>
                        <td class="p-4 text-xs text-[#9C8EAD]">${escapeHtml(u.email)}</td>
                        <td class="p-4">
                            <span class="px-2.5 py-1 rounded-full text-[11px] font-semibold ${isAdmin ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-[#2B2138] text-[#C2ADC9]'}">
                                ${isAdmin ? 'Administrador' : 'Psicólogo'}
                            </span>
                        </td>
                        <td class="p-4">
                            <div class="flex items-center gap-2">
                                <span class="px-2.5 py-1 rounded-full text-[11px] font-semibold ${temLP ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-white/5 text-[#9C8EAD] border border-[#2E2538]'}">
                                    ${temLP ? '🌐 Com LP' : '🔒 Sem LP'}
                                </span>
                                <button type="button" onclick="abrirLPDoUsuarioAdmin('${u.id}')" class="px-2.5 py-1 bg-[#2B2138] text-[#C2ADC9] hover:bg-[#8E73AD] hover:text-white rounded-lg text-[11px] font-semibold transition">
                                    ${temLP ? 'Editar LP' : 'Liberar LP'}
                                </button>
                            </div>
                        </td>
                        <td class="p-4 text-center">
                            <select onchange="alterarRoleUsuario('${u.id}', this.value)" class="text-xs input-dark rounded-xl px-2 py-1 font-semibold outline-none">
                                <option value="psicologo" ${!isAdmin ? 'selected' : ''}>Psicólogo</option>
                                <option value="admin" ${isAdmin ? 'selected' : ''}>Administrador</option>
                            </select>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        async function salvarNomeUsuarioEquipe(userId) {
            if (!ehAdmin()) return;
            const input = document.getElementById(`nomeUser_${userId}`);
            if (!input || !input.value.trim()) return;

            const { error } = await client.from('usuarios_perfis').update({ nome: input.value.trim() }).eq('id', userId);
            if (error) {
                alert("Erro ao atualizar nome: " + error.message);
            } else {
                if (usuarioAtualPerfil && usuarioAtualPerfil.id === userId) {
                    usuarioAtualPerfil.nome = input.value.trim();
                    atualizarSaudacao();
                }
                alert("Nome atualizado com sucesso!");
                await carregarEquipe();
                await carregarDados();
            }
        }

        async function alterarRoleUsuario(userId, novoRole) {
            if (!ehAdmin()) return;
            const { error } = await client.from('usuarios_perfis').update({ role: novoRole }).eq('id', userId);
            if (error) alert("Erro ao alterar nível: " + error.message);
            else {
                alert("Nível atualizado com sucesso!");
                carregarEquipe();
            }
        }

        function alternarGravacaoVoz() {
            const btn = document.getElementById('btnVozDrawer');
            const icone = document.getElementById('iconeMicDrawer');
            const texto = document.getElementById('textoMicDrawer');
            const textarea = document.getElementById('textoNovoProntuario');

            if (!textarea) {
                alert("Abra a ficha do paciente primeiro.");
                return;
            }

            const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRec) {
                alert("Seu navegador não suporta reconhecimento de voz nativo. Use o Google Chrome.");
                return;
            }

            function definirVisual(ativo, msg) {
                if (!btn) return;
                if (ativo) {
                    btn.className = "px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 animate-pulse shadow-md";
                    if (icone) icone.textContent = "⏹️";
                    if (texto) texto.textContent = msg || "Ouvindo... Fale agora";
                } else {
                    btn.className = "px-3 py-1.5 btn-plum text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm";
                    if (icone) icone.textContent = "🎙️";
                    if (texto) texto.textContent = "Gravar Voz";
                }
            }

            if (gravando) {
                usuarioPediuParaParar = true;
                gravando = false;
                definirVisual(false);
                if (recognition) {
                    try { recognition.stop(); } catch(e){}
                    recognition = null;
                }
                return;
            }

            try {
                usuarioPediuParaParar = false;
                gravando = true;

                if (recognition) {
                    try { recognition.abort(); } catch(e){}
                    recognition = null;
                }

                recognition = new SpeechRec();
                recognition.lang = 'pt-BR';
                recognition.continuous = false; 
                recognition.interimResults = true;
                recognition.maxAlternatives = 1;

                let baseTexto = textarea.value.trim();
                if (baseTexto.length > 0) baseTexto += "\n";

                recognition.onstart = () => {
                    definirVisual(true, "Ouvindo... Fale agora");
                };

                recognition.onresult = (e) => {
                    let transcrito = "";
                    for (let i = 0; i < e.results.length; i++) {
                        transcrito += e.results[i][0].transcript;
                    }
                    textarea.value = baseTexto + transcrito;
                    textarea.scrollTop = textarea.scrollHeight;
                };

                recognition.onerror = (e) => {
                    if (e.error === 'no-speech' || e.error === 'aborted') return;
                    if (e.error === 'network') {
                        gravando = false;
                        definirVisual(false);
                        alert("⚠️ Erro de Rede na Transcrição. Verifique bloqueadores de anúncio ou conexão.");
                        return;
                    }
                    if (e.error === 'not-allowed') {
                        alert("Permissão de microfone negada. Clique no cadeado ao lado da URL e permita o microfone.");
                        gravando = false;
                        definirVisual(false);
                    }
                };

                recognition.onend = () => {
                    baseTexto = textarea.value.trim();
                    if (baseTexto.length > 0) baseTexto += " ";

                    if (gravando && !usuarioPediuParaParar) {
                        setTimeout(() => {
                            try {
                                if (gravando && !usuarioPediuParaParar) recognition.start();
                            } catch(err) {
                                gravando = false;
                                definirVisual(false);
                            }
                        }, 250);
                    } else {
                        gravando = false;
                        definirVisual(false);
                    }
                };

                recognition.start();

            } catch (err) {
                gravando = false;
                definirVisual(false);
                alert("Não foi possível acessar o dispositivo de microfone.");
            }
        }

        async function atualizarStatusPaciente(id, status) {
            await client.from('pacientes').update({ status }).eq('id', id);
            await carregarDados();
        }

        async function atualizarStatusAtendimento(id, status) {
            const sessao = todosAtendimentosCache.find(a => a.id === id);

            const { error } = await client.from('atendimentos').update({ status }).eq('id', id);
            if (error) {
                alert("Erro ao atualizar status da sessão: " + error.message);
                return;
            }

            if (status === 'Realizada' && sessao && sessao.paciente_id) {
                const pac = todosPacientesCache.find(p => p.id === sessao.paciente_id) || {};
                const valorSessao = parseFloat(pac.valor_padrao_sessao ?? 150);
                const dataSessaoStr = sessao.data_hora ? sessao.data_hora.slice(0, 10) : obterChaveDiaLocal();

                if (valorSessao > 0) {
                    const jaTemCobranca = todosPagamentosCache.some(pg =>
                        pg.paciente_id === sessao.paciente_id &&
                        pg.data_vencimento === dataSessaoStr
                    );

                    if (!jaTemCobranca) {
                        await client.from('pagamentos').insert([{
                            paciente_id: sessao.paciente_id,
                            valor: valorSessao,
                            data_vencimento: dataSessaoStr,
                            status: 'Pendente'
                        }]);
                    }
                }
            }

            await carregarDados();
            if (pacienteSelecionadoId) {
                renderizarSessoesDoPacienteNaFicha(pacienteSelecionadoId);
            }
        }

        async function excluirSessao(atendimentoId) {
            if (!confirm("Deseja realmente excluir este agendamento?\n\nA cobrança vinculada a esta sessão também será removida da lista.")) return;

            const sessao = todosAtendimentosCache.find(a => a.id === atendimentoId);
            const agoraIso = new Date().toISOString();

            const { error } = await client
                .from('atendimentos')
                .update({ excluido_em: agoraIso })
                .eq('id', atendimentoId);

            if (error) {
                alert("Erro ao excluir agendamento: " + error.message);
                return;
            }

            if (sessao && sessao.paciente_id && sessao.data_hora) {
                const dataSessaoStr = obterChaveDiaLocal(new Date(sessao.data_hora));
                const cobrancaVinculada = todosPagamentosCache.find(pg =>
                    pg.paciente_id === sessao.paciente_id &&
                    pg.data_vencimento === dataSessaoStr
                );

                if (cobrancaVinculada) {
                    await client
                        .from('pagamentos')
                        .update({ excluido_em: agoraIso })
                        .eq('id', cobrancaVinculada.id);
                }
            }

            await carregarDados();
            if (pacienteSelecionadoId) {
                renderizarSessoesDoPacienteNaFicha(pacienteSelecionadoId);
            }
        }
        
        function abrirModalCobranca() {
            const clientes = todosPacientesCache.filter(p => p.status !== 'Novo Contato');
            const select = document.getElementById('cobrancaClienteSelect');
            if (clientes.length === 0) return alert("Cadastre um paciente primeiro.");
            select.innerHTML = clientes.map(c => `<option value="${c.id}">${escapeHtml(c.nome)}</option>`).join('');
            document.getElementById('cobrancaVencimento').value = obterChaveDiaLocal();
            document.getElementById('modalCobranca').classList.remove('hidden');
        }

        document.getElementById('formNovaCobranca').addEventListener('submit', async (e) => {
            e.preventDefault();
            const paciente_id = document.getElementById('cobrancaClienteSelect').value;
            const valor = parseFloat(document.getElementById('cobrancaValor').value) || 150.00;
            const data_vencimento = document.getElementById('cobrancaVencimento').value;

            await client.from('pagamentos').insert([{ paciente_id, valor, data_vencimento, status: 'Pendente' }]);
            fecharModal('modalCobranca');
            await carregarDados();
        });

        function renderizarTriagensCards(leads) {
            const container = document.getElementById('gridTriagens');
            if (!container) return;
            if (leads.length === 0) {
                container.innerHTML = `<div class="p-8 text-center text-xs text-[#9C8EAD] col-span-2 card-surface">Nenhuma nova triagem pendente no momento.</div>`;
                return;
            }
            container.innerHTML = leads.map(l => `
                <div class="card-surface p-6 flex flex-col justify-between space-y-4">
                    <div>
                        <div class="flex justify-between items-start mb-2">
                            <h4 class="font-bold text-sm text-[#F3EEF6]">${escapeHtml(l.nome)}</h4>
                            <span class="text-xs text-[#9C8EAD] font-medium">${escapeHtml(l.whatsapp || '')}</span>
                        </div>
                        <div class="flex gap-2 mb-3">
                            <span class="px-2 py-0.5 bg-[#141019] border border-[#32283D] rounded-md text-[10px] text-[#C2ADC9] font-semibold">${escapeHtml(l.modalidade || 'Online')}</span>
                            <span class="px-2 py-0.5 bg-[#141019] border border-[#32283D] rounded-md text-[10px] text-[#9C8EAD]">${escapeHtml(l.periodo_preferencia || 'Flexível')}</span>
                        </div>
                        <p class="text-xs text-[#9C8EAD] italic">"${escapeHtml(l.motivo_consulta || 'Sem descrição.')}"</p>
                    </div>
                    <div class="flex items-center gap-2 pt-2">
                        <button onclick="tornarCliente('${l.id}')" class="flex-1 py-2.5 btn-plum rounded-xl text-xs font-semibold shadow-sm">Tornar Paciente</button>
                        <button onclick="excluirTriagem('${l.id}')" title="Excluir triagem sem tornar paciente" class="px-4 py-2.5 bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 rounded-xl text-xs font-semibold transition">🗑️ Excluir</button>
                    </div>
                </div>
            `).join('');
        }

        async function tornarCliente(id) {
            const psicologa_id = usuarioAtualPerfil ? usuarioAtualPerfil.id : null;
            await client.from('pacientes').update({ 
                status: 'Em Atendimento',
                psicologa_id
            }).eq('id', id);
            await carregarDados();
        }

        async function excluirTriagem(id, nomeFallback = '') {
            const leadObj = todosPacientesCache.find(item => item.id === id);
            const nome = leadObj ? leadObj.nome : (nomeFallback || 'este contato');
            if (!confirm(`Deseja excluir esta triagem de "${nome}"? Ela será removida permanentemente.`)) return;
            const { error } = await client
                .from('pacientes')
                .update({ excluido_em: new Date().toISOString() })
                .eq('id', id);
            if (error) alert("Erro ao excluir triagem: " + error.message);
            else await carregarDados();
        }

        let filtroPsicologaCobrancaAtivo = 'Todas';

        function prepararFiltroPsicologaCobranca() {
            const select = document.getElementById('filtroPsicologaCobranca');
            const thPsi = document.getElementById('thPsiCobranca');
            if (!select) return;

            if (ehAdmin()) {
                select.classList.remove('hidden');
                if (thPsi) thPsi.classList.remove('hidden');

                const psicologas = todosUsuariosCache.filter(u => u.role === 'psicologo' || todosPacientesCache.some(p => p.psicologa_id === u.id));
                const valorAnterior = select.value;

                select.innerHTML = `<option value="Todas">Todas as Psicólogas</option>` +
                    psicologas.map(u => `<option value="${u.id}">${escapeHtml(u.nome || u.email)}</option>`).join('');

                if ([...select.options].some(opt => opt.value === valorAnterior)) {
                    select.value = valorAnterior;
                }
            } else {
                select.classList.add('hidden');
                if (thPsi) thPsi.classList.add('hidden');
            }
        }

        function aoMudarFiltroPsicologaCobranca() {
            const select = document.getElementById('filtroPsicologaCobranca');
            filtroPsicologaCobrancaAtivo = select ? select.value : 'Todas';
            aplicarFiltrosCobrancas();
        }

        function sincronizarBotoesFiltroCobranca() {
            ['todas', 'areceber', 'atraso', 'pagas'].forEach(id => {
                const el = document.getElementById(`cob-${id}`);
                if (el) el.className = "px-3 py-1.5 rounded-xl text-[#9C8EAD] hover:text-white";
            });

            const btnAtivo =
                filtroCobrancaAtivo === 'Todas' ? document.getElementById('cob-todas') :
                filtroCobrancaAtivo === 'A receber' ? document.getElementById('cob-areceber') :
                filtroCobrancaAtivo === 'Em atraso' ? document.getElementById('cob-atraso') :
                filtroCobrancaAtivo === 'Pagas' ? document.getElementById('cob-pagas') : null;

            if (btnAtivo) {
                btnAtivo.className = "px-3 py-1.5 rounded-xl bg-[#2B2138] text-white shadow-sm";
            }
        }

        function filtrarStatusCobranca(status) {
            filtroCobrancaAtivo = status;
            sincronizarBotoesFiltroCobranca();
            aplicarFiltrosCobrancas();
        }

        function obterPagamentosFiltradosPorPsicologa() {
            if (!ehAdmin() || filtroPsicologaCobrancaAtivo === 'Todas') {
                return todosPagamentosCache;
            }
            const idsPacientesDaPsi = new Set(
                todosPacientesCache
                    .filter(p => p.psicologa_id === filtroPsicologaCobrancaAtivo)
                    .map(p => p.id)
            );
            return todosPagamentosCache.filter(pg => idsPacientesDaPsi.has(pg.paciente_id));
        }

        function aplicarFiltrosCobrancas() {
            prepararFiltroPsicologaCobranca();
            sincronizarBotoesFiltroCobranca();

            const pagamentosBase = obterPagamentosFiltradosPorPsicologa();
            atualizarKpisFinanceiros(pagamentosBase);

            const buscaEl = document.getElementById('buscaCobranca');
            const busca = (buscaEl ? buscaEl.value : '').toLowerCase();
            const hojeStr = obterChaveDiaLocal();
            const isAdmin = ehAdmin();

            const filtrados = pagamentosBase.filter(p => {
                const isPago = p.status === 'Pago';
                const isAtrasado = !isPago && p.data_vencimento && p.data_vencimento < hojeStr;

                let matchStatus = true;
                if (filtroCobrancaAtivo === 'A receber') matchStatus = !isPago && !isAtrasado;
                else if (filtroCobrancaAtivo === 'Em atraso') matchStatus = isAtrasado;
                else if (filtroCobrancaAtivo === 'Pagas') matchStatus = isPago;

                const pacNome = p.pacientes ? p.pacientes.nome.toLowerCase() : '';
                return matchStatus && pacNome.includes(busca);
            });

            const tbody = document.getElementById('tabelaPagamentos');
            if (!tbody) return;

            if (filtrados.length === 0) {
                const cols = isAdmin ? 6 : 5;
                tbody.innerHTML = `<tr><td colspan="${cols}" class="p-6 text-center text-[#9C8EAD]">Nenhuma cobrança encontrada neste filtro.</td></tr>`;
                return;
            }

            tbody.innerHTML = filtrados.map(pg => {
                const pac = pg.pacientes;
                const pacObj = todosPacientesCache.find(item => item.id === pg.paciente_id);
                const nomePsi = pacObj ? obterNomePsicologa(pacObj.psicologa_id) : '—';

                const isPago = pg.status === 'Pago';
                const isAtrasado = !isPago && pg.data_vencimento && pg.data_vencimento < hojeStr;

                const sitPill = isPago 
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                    : (isAtrasado ? 'bg-red-500/15 text-red-400 border border-red-500/30' : 'bg-amber-500/15 text-amber-300 border border-amber-500/30');
                const sitText = isPago ? '● Pago' : (isAtrasado ? '● Em atraso' : '● Pendente');

                const colPsi = isAdmin ? `<td class="p-4 text-xs text-[#9C8EAD]">${escapeHtml(nomePsi)}</td>` : '';
                const emitidoRS = isPago && typeof foiEmitidoReceitaSaude === 'function' && foiEmitidoReceitaSaude(pg.id);
                const badgeRS = emitidoRS
                    ? `<span class="ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30" title="Emitido no Receita Saúde">🏛️ Receita OK</span>`
                    : '';

                return `
                    <tr class="hover:bg-white/[0.03]">
                        <td class="p-4 font-bold text-xs text-[#F3EEF6]">${escapeHtml(pac ? pac.nome : 'Paciente')}</td>
                        ${colPsi}
                        <td class="p-4 text-xs font-bold text-white">${formatarBRL(pg.valor)}</td>
                        <td class="p-4 text-xs text-[#9C8EAD]">${pg.data_vencimento ? new Date(pg.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                        <td class="p-4">
                            <span class="px-2.5 py-1 rounded-full text-[11px] font-semibold ${sitPill}">${sitText}</span>
                            ${badgeRS}
                        </td>
                        <td class="p-4">
                            <div class="flex items-center justify-center gap-2">
                                ${!isPago 
                                    ? `<button onclick="marcarComoPago('${pg.id}')" class="px-3 py-1 btn-plum rounded-lg text-xs font-semibold shadow-sm">Confirmar</button>` 
                                    : `<button onclick="abrirModalReceitaSaudeIndividual('${pg.id}')" class="px-2.5 py-1 ${emitidoRS ? 'bg-purple-500/15 text-purple-300 border-purple-500/30' : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'} hover:opacity-90 border rounded-lg text-xs font-semibold transition">🏛️ Receita Saúde / Recibo</button>`}
                                <button onclick="excluirCobranca('${pg.id}')" title="Excluir cobrança" class="text-red-400 hover:text-red-300 p-1.5 hover:bg-red-500/15 rounded-lg transition">🗑️</button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        async function marcarComoPago(id) {
            versaoMutacaoLocal++;
            const hoje = obterChaveDiaLocal();
            const itemLocal = todosPagamentosCache.find(p => p.id === id);
            if (itemLocal) {
                itemLocal.status = 'Pago';
                itemLocal.data_pagamento = hoje;
                aplicarFiltrosCobrancas();
                atualizarKpisFinanceiros(todosPagamentosCache);
            }
            const { error } = await client.from('pagamentos').update({ status: 'Pago', data_pagamento: hoje }).eq('id', id);
            if (error) {
                alert('Erro ao confirmar pagamento: ' + error.message);
            }
            await carregarDados();
        }

        async function excluirCobranca(id) {
            if (!confirm("Deseja realmente excluir esta cobrança? Essa ação não pode ser desfeita.")) return;
            versaoMutacaoLocal++;
            const { error } = await client
                .from('pagamentos')
                .update({ excluido_em: new Date().toISOString() })
                .eq('id', id);
            if (error) {
                alert("Erro ao excluir cobrança: " + error.message);
            } else {
                todosPagamentosCache = todosPagamentosCache.filter(p => p.id !== id);
                aplicarFiltrosCobrancas();
                await carregarDados();
            }
        }

        function atualizarKpisFinanceiros(pagamentos) {
            const hoje = new Date();
            const mesAtual = hoje.getMonth() + 1;
            const anoAtual = hoje.getFullYear();
            const hojeChave = obterChaveDiaLocal(hoje);

            let totalRecebidoMes = 0;
            let totalAReceber = 0;
            let totalAtraso = 0;
            let countAbertas = 0;
            let countAtrasadas = 0;

            pagamentos.forEach(pg => {
                const val = parseFloat(pg.valor || 0);
                const venc = pg.data_vencimento || '';
                if (pg.status === 'Pago') {
                    const dtPag = pg.data_pagamento || venc;
                    if (dtPag && dtPag.startsWith(`${anoAtual}-${String(mesAtual).padStart(2, '0')}`)) {
                        totalRecebidoMes += val;
                    }
                } else {
                    if (venc && venc < hojeChave) {
                        totalAtraso += val;
                        countAtrasadas++;
                    } else {
                        totalAReceber += val;
                        countAbertas++;
                    }
                }
            });

            document.getElementById('cardRecebidoMes').textContent = formatarBRL(totalRecebidoMes);
            document.getElementById('cardAReceberMes').textContent = formatarBRL(totalAReceber);
            document.getElementById('kpiAReceber').textContent = formatarBRL(totalAReceber);
            document.getElementById('cardAtraso').textContent = formatarBRL(totalAtraso);
            document.getElementById('subAReceberContagem').textContent = `${countAbertas} ${countAbertas === 1 ? 'aberta' : 'abertas'}`;
            document.getElementById('subAtrasoContagem').textContent = countAtrasadas > 0 ? `${countAtrasadas} ${countAtrasadas === 1 ? 'vencida' : 'vencidas'}` : 'nada vencido';
        }

        function alternarTelaAuth(modo) {
            esconderTodasTelasAuth();
            if (modo === 'cadastro') {
                const signupForm = document.getElementById('signupForm');
                if (signupForm) signupForm.classList.remove('hidden');
            } else {
                const loginForm = document.getElementById('loginForm');
                if (loginForm) loginForm.classList.remove('hidden');
            }
        }

        document.getElementById('signupForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const nome = document.getElementById('signupNome').value.trim();
            const crp = document.getElementById('signupCrp').value.trim();
            const email = document.getElementById('signupEmail').value.trim();
            const password = document.getElementById('signupPassword').value;
            const feedback = document.getElementById('signupFeedback');
            const btn = document.getElementById('signupSubmitBtn');

            btn.disabled = true;
            btn.textContent = "Criando sua clínica...";
            feedback.textContent = "";

            const { data, error } = await client.auth.signUp({
                email,
                password,
                options: { data: { nome, crp } }
            });

            btn.disabled = false;
            btn.textContent = "Começar meus 7 dias grátis";

            if (error) {
                feedback.className = "text-xs text-red-400 text-center font-medium min-h-[16px]";
                feedback.textContent = "Erro ao criar conta: " + error.message;
                return;
            }

            if (data.session) {
                await checarPerfilUsuario(data.user.id, data.user.email);
                mostrarApp();
            } else {
                feedback.className = "text-xs text-emerald-400 text-center font-medium min-h-[16px]";
                feedback.textContent = "✓ Conta criada! Verifique seu e-mail ou faça login.";
            }
        });

        function atualizarBadgeTrial() {
            const badge = document.getElementById('trialBadgeNav');
            if (!badge || !usuarioAtualPerfil) return;

            if (usuarioAtualPerfil.plano === 'trial' && usuarioAtualPerfil.trial_ends_at) {
                const fim = new Date(usuarioAtualPerfil.trial_ends_at);
                const agora = new Date();
                const diasRestantes = Math.ceil((fim - agora) / (1000 * 60 * 60 * 24));

                badge.classList.remove('hidden');
                if (diasRestantes > 0) {
                    badge.textContent = `Trial: ${diasRestantes}d`;
                    badge.className = "px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30";
                } else {
                    badge.textContent = "Trial expirado";
                    badge.className = "px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-500/20 text-red-300 border border-red-500/30";
                }
            } else {
                badge.classList.add('hidden');
            }
        }

        function carregarPaginaPerfil() {
            if (!usuarioAtualPerfil) return;
            const nomeExibicao = obterNomeExibicaoUsuario();
            const iniciais = nomeExibicao.split(' ').filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase() || 'PS';

            const elIniciais = document.getElementById('paginaPerfilIniciais');
            if (elIniciais) elIniciais.textContent = iniciais;

            const elNomeTopo = document.getElementById('paginaPerfilNomeTopo');
            if (elNomeTopo) elNomeTopo.textContent = nomeExibicao;

            const elEmail = document.getElementById('paginaPerfilEmail');
            if (elEmail) elEmail.textContent = usuarioAtualPerfil.email || '';

            const elRole = document.getElementById('paginaPerfilRoleBadge');
            if (elRole) {
                if (ehAdmin()) {
                    elRole.textContent = 'Administrador';
                    elRole.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-400/30';
                } else {
                    elRole.textContent = 'Psicóloga';
                    elRole.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/10 text-[#E5DCED]';
                }
            }

            const elResumoCrp = document.getElementById('paginaPerfilResumoCrp');
            if (elResumoCrp) {
                const partes = [
                    usuarioAtualPerfil.crp ? `CRP ${usuarioAtualPerfil.crp}` : 'CRP não informado',
                    usuarioAtualPerfil.abordagem || ''
                ].filter(Boolean);
                elResumoCrp.textContent = partes.join(' · ');
            }

            const inputNome = document.getElementById('perfilNome');
            const inputCrp = document.getElementById('perfilCrp');
            const inputAbordagem = document.getElementById('perfilAbordagem');
            const inputPix = document.getElementById('perfilPix');

            if (inputNome) inputNome.value = nomeExibicao;
            if (inputCrp) inputCrp.value = usuarioAtualPerfil.crp || '';
            if (inputAbordagem) inputAbordagem.value = usuarioAtualPerfil.abordagem || '';
            if (inputPix) inputPix.value = usuarioAtualPerfil.chave_pix || '';

            const linkExclusivo = `${window.location.origin}/triagem?triagem=${usuarioAtualPerfil.id}`;
            const elPreviewLink = document.getElementById('perfilPreviewLinkTriagem');
            if (elPreviewLink) elPreviewLink.textContent = linkExclusivo;
            const btnAbrirTriagem = document.getElementById('btnAbrirMeuLinkTriagem');
            if (btnAbrirTriagem) btnAbrirTriagem.href = linkExclusivo;
        }

        function abrirModalPerfilProfissional() {
            mudarAba('perfil');
        }

        document.getElementById('formPerfilProfissional').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!usuarioAtualPerfil || !usuarioAtualPerfil.id) return;

            const btn = document.getElementById('btnSalvarPerfilPag');
            const txtOrig = btn ? btn.textContent : '';
            if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

            const nome = document.getElementById('perfilNome').value.trim();
            const crp = document.getElementById('perfilCrp').value.trim();
            const abordagem = document.getElementById('perfilAbordagem').value.trim();
            const chave_pix = document.getElementById('perfilPix').value.trim();

            const { error } = await client
                .from('usuarios_perfis')
                .update({ nome, crp, abordagem, chave_pix })
                .eq('id', usuarioAtualPerfil.id);

            if (btn) { btn.disabled = false; btn.textContent = txtOrig; }

            if (error) {
                alert("Erro ao salvar perfil: " + error.message);
            } else {
                usuarioAtualPerfil.nome = nome;
                usuarioAtualPerfil.crp = crp;
                usuarioAtualPerfil.abordagem = abordagem;
                usuarioAtualPerfil.chave_pix = chave_pix;
                
                atualizarSaudacao();
                carregarPaginaPerfil();
                alert("Dados profissionais salvos com sucesso!");
            }
        });

        document.getElementById('formAlterarSenhaPerfil')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const s1 = document.getElementById('perfilNovaSenha').value;
            const s2 = document.getElementById('perfilConfirmarSenha').value;
            const fb = document.getElementById('feedbackSenhaPerfil');
            const btn = document.getElementById('btnSalvarSenhaPerfil');

            if (s1 !== s2) {
                if (fb) {
                    fb.className = 'text-[11px] text-red-400 font-semibold';
                    fb.textContent = 'As senhas não coincidem.';
                }
                return;
            }

            if (btn) { btn.disabled = true; btn.textContent = 'Atualizando...'; }
            if (fb) fb.textContent = '';

            const { error } = await client.auth.updateUser({ password: s1 });

            if (btn) { btn.disabled = false; btn.textContent = '🔒 Atualizar Senha'; }

            if (error) {
                if (fb) {
                    fb.className = 'text-[11px] text-red-400 font-semibold';
                    fb.textContent = 'Erro: ' + error.message;
                }
            } else {
                document.getElementById('formAlterarSenhaPerfil').reset();
                if (fb) {
                    fb.className = 'text-[11px] text-emerald-400 font-semibold';
                    fb.textContent = '✓ Senha atualizada com sucesso!';
                }
            }
        });

        let pagamentoReceitaSaudeAtualId = null;

        function obterMapaReceitaSaudeStorage() {
            try {
                return JSON.parse(localStorage.getItem('gnoth_receita_saude_emitidos') || '{}');
            } catch (e) {
                return {};
            }
        }

        function foiEmitidoReceitaSaude(pagamentoId) {
            const pg = todosPagamentosCache.find(p => p.id === pagamentoId);
            if (pg && pg.receita_saude_emitido) return true;
            const mapa = obterMapaReceitaSaudeStorage();
            return Boolean(mapa[pagamentoId]);
        }

        function definirEmitidoReceitaSaude(pagamentoId, status) {
            const mapa = obterMapaReceitaSaudeStorage();
            if (status) {
                mapa[pagamentoId] = new Date().toISOString();
            } else {
                delete mapa[pagamentoId];
            }
            localStorage.setItem('gnoth_receita_saude_emitidos', JSON.stringify(mapa));
            const pg = todosPagamentosCache.find(p => p.id === pagamentoId);
            if (pg) pg.receita_saude_emitido = status;
        }

        function limparCpfApenasDigitos(cpf) {
            return String(cpf || '').replace(/\D/g, '').slice(0, 11);
        }

        function formatarDataDDMMAAAA(isoDateStr) {
            const base = (isoDateStr || obterChaveDiaLocal()).slice(0, 10);
            const [ano, mes, dia] = base.split('-');
            if (!ano || !mes || !dia) return new Date().toLocaleDateString('pt-BR');
            return `${dia}/${mes}/${ano}`;
        }

        function montarLinhaCSVReceitaSaude(pg) {
            const pac = todosPacientesCache.find(item => item.id === pg.paciente_id) || pg.pacientes || {};
            const dataPag = formatarDataDDMMAAAA(pg.data_pagamento || pg.data_vencimento);
            const valorVirgula = Number(pg.valor || 0).toFixed(2).replace('.', ',');
            const cpfBeneficiario = limparCpfApenasDigitos(pac.cpf);
            const cpfPagador = limparCpfApenasDigitos(pac.responsavel_cpf) || cpfBeneficiario;
            const nomePacLimpo = (pac.nome || 'Paciente').replace(/;/g, ' ').trim();
            const descricao = `Atendimento psicologico - ${nomePacLimpo}`.slice(0, 250);

            // Layout Oficial Receita Federal (Carnê-Leão Web / Receita Saúde - 12 colunas separadas por ;)
            // 1:Data; 2:CodRend(R01.001.001); 3:Ocupacao(255-Psicologo); 4:Valor; 5:Deducao; 6:Historico; 7:Tipo(PF); 8:CPFPagador; 9:CPFBeneficiario; 10:IndSemCPF; 11:CNPJ; 12:IndIRRF
            const indSemCpf = cpfBeneficiario.length === 11 ? '' : 'S';
            return [
                dataPag,
                'R01.001.001',
                '255',
                valorVirgula,
                '',
                descricao,
                'PF',
                cpfPagador,
                cpfBeneficiario,
                indSemCpf,
                '',
                ''
            ].join(';');
        }

        function dispararDownloadCSV(conteudoLinhas, nomeArquivo) {
            const csvFinal = '\uFEFF' + conteudoLinhas.join('\r\n');
            const blob = new Blob([csvFinal], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = nomeArquivo;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        function abrirModalReceitaSaudeIndividual(pagamentoId) {
            const pg = todosPagamentosCache.find(item => item.id === pagamentoId);
            if (!pg) return;

            pagamentoReceitaSaudeAtualId = pagamentoId;
            const pac = todosPacientesCache.find(item => item.id === pg.paciente_id) || pg.pacientes || {};

            document.getElementById('rsIndNomePaciente').textContent = pac.nome || 'Paciente';
            document.getElementById('rsIndValorFormatado').textContent = formatarBRL(pg.valor);
            document.getElementById('rsIndDataQuitação').textContent = `Data do pagamento: ${formatarDataDDMMAAAA(pg.data_pagamento || pg.data_vencimento)}`;

            const inputCpfPac = document.getElementById('rsIndInputCpfPaciente');
            const inputCpfResp = document.getElementById('rsIndInputCpfResponsavel');
            if (inputCpfPac) inputCpfPac.value = pac.cpf || '';
            if (inputCpfResp) inputCpfResp.value = pac.responsavel_cpf || '';

            atualizarUICamposModalReceitaIndividual();
            const modal = document.getElementById('modalReceitaSaudeIndividual');
            if (modal) {
                modal.classList.remove('hidden');
                modal.style.display = 'flex';
            }
        }

        function atualizarUICamposModalReceitaIndividual() {
            const pg = todosPagamentosCache.find(item => item.id === pagamentoReceitaSaudeAtualId);
            if (!pg) return;
            const pac = todosPacientesCache.find(item => item.id === pg.paciente_id) || pg.pacientes || {};

            const cpfBenef = limparCpfApenasDigitos(document.getElementById('rsIndInputCpfPaciente')?.value || pac.cpf);
            const cpfPag = limparCpfApenasDigitos(document.getElementById('rsIndInputCpfResponsavel')?.value || pac.responsavel_cpf) || cpfBenef;
            const valorVirgula = Number(pg.valor || 0).toFixed(2).replace('.', ',');

            document.getElementById('rsBtnTxtCpfPagador').textContent = cpfPag || 'Não informado';
            document.getElementById('rsBtnTxtCpfBenef').textContent = cpfBenef || 'Não informado';
            document.getElementById('rsBtnTxtValor').textContent = valorVirgula;

            const statusCpfEl = document.getElementById('rsIndStatusCpfTexto');
            if (statusCpfEl) {
                if (cpfBenef.length === 11) {
                    statusCpfEl.className = 'text-[11px] text-emerald-400 font-semibold';
                    statusCpfEl.textContent = '✓ CPF válido (11 dígitos) pronto para o Receita Saúde';
                } else {
                    statusCpfEl.className = 'text-[11px] text-amber-300 font-semibold';
                    statusCpfEl.textContent = '⚠️ Informe o CPF (11 dígitos) do paciente para o Receita Saúde';
                }
            }

            const emitido = foiEmitidoReceitaSaude(pg.id);
            const badgeModal = document.getElementById('badgeStatusReceitaModal');
            const btnToggle = document.getElementById('btnToggleEmitidoReceitaModal');

            if (badgeModal) {
                if (emitido) {
                    badgeModal.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30';
                    badgeModal.textContent = '✓ Já Emitido na Receita';
                } else {
                    badgeModal.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30';
                    badgeModal.textContent = '● Pendente de Emissão Fiscal';
                }
            }

            if (btnToggle) {
                if (emitido) {
                    btnToggle.className = 'py-2.5 px-4 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-200 text-xs font-semibold transition flex items-center justify-center gap-1.5';
                    btnToggle.innerHTML = '<span>✓</span> Emitido na Receita (Desmarcar)';
                } else {
                    btnToggle.className = 'py-2.5 px-4 rounded-xl bg-[#141019] hover:bg-emerald-500/20 border border-[#32283D] hover:border-emerald-500/40 text-[#E5DCED] hover:text-emerald-300 text-xs font-semibold transition flex items-center justify-center gap-1.5';
                    btnToggle.innerHTML = '<span>✅</span> Marcar Emitido na Receita';
                }
            }
        }

        async function salvarCpfRapidoReceitaSaude() {
            const pg = todosPagamentosCache.find(item => item.id === pagamentoReceitaSaudeAtualId);
            if (!pg || !pg.paciente_id) return;

            const novoCpfPac = document.getElementById('rsIndInputCpfPaciente').value.trim();
            const novoCpfResp = document.getElementById('rsIndInputCpfResponsavel').value.trim();

            const { error } = await client
                .from('pacientes')
                .update({
                    cpf: novoCpfPac || null,
                    responsavel_cpf: novoCpfResp || null
                })
                .eq('id', pg.paciente_id);

            if (error) {
                alert('Erro ao salvar CPF: ' + error.message);
                return;
            }

            const pac = todosPacientesCache.find(p => p.id === pg.paciente_id);
            if (pac) {
                pac.cpf = novoCpfPac || null;
                pac.responsavel_cpf = novoCpfResp || null;
            }
            atualizarUICamposModalReceitaIndividual();
            exibirToastTempoReal('CPF atualizado no cadastro do paciente!');
        }

        function copiarCampoReceitaSaude(tipo) {
            const pg = todosPagamentosCache.find(item => item.id === pagamentoReceitaSaudeAtualId);
            if (!pg) return;
            const pac = todosPacientesCache.find(item => item.id === pg.paciente_id) || pg.pacientes || {};

            const cpfBenef = limparCpfApenasDigitos(document.getElementById('rsIndInputCpfPaciente')?.value || pac.cpf);
            const cpfPag = limparCpfApenasDigitos(document.getElementById('rsIndInputCpfResponsavel')?.value || pac.responsavel_cpf) || cpfBenef;
            const valorVirgula = Number(pg.valor || 0).toFixed(2).replace('.', ',');

            let texto = '';
            let label = '';
            if (tipo === 'cpfPagador') {
                texto = cpfPag;
                label = 'CPF do Pagador';
            } else if (tipo === 'cpfBeneficiario') {
                texto = cpfBenef;
                label = 'CPF do Paciente';
            } else if (tipo === 'valor') {
                texto = valorVirgula;
                label = 'Valor';
            } else {
                texto = `Atendimento psicológico referente a ${pac.nome || 'paciente'}`;
                label = 'Descrição';
            }

            if (!texto) {
                alert(`O campo ${label} está vazio. Preencha o CPF acima primeiro.`);
                return;
            }

            navigator.clipboard.writeText(texto);
            exibirToastTempoReal(`${label} copiado: ${texto}`);
        }

        function alternarEmitidoReceitaSaudeAtual() {
            if (!pagamentoReceitaSaudeAtualId) return;
            const novoStatus = !foiEmitidoReceitaSaude(pagamentoReceitaSaudeAtualId);
            definirEmitidoReceitaSaude(pagamentoReceitaSaudeAtualId, novoStatus);
            atualizarUICamposModalReceitaIndividual();
            aplicarFiltrosCobrancas();
            exibirToastTempoReal(novoStatus ? 'Marcado como emitido no Receita Saúde!' : 'Status de emissão removido.');
        }

        function exportarCSVUnicoReceitaSaude() {
            const pg = todosPagamentosCache.find(item => item.id === pagamentoReceitaSaudeAtualId);
            if (!pg) return;

            const pac = todosPacientesCache.find(item => item.id === pg.paciente_id) || pg.pacientes || {};
            const cpfBenef = limparCpfApenasDigitos(document.getElementById('rsIndInputCpfPaciente')?.value || pac.cpf);
            if (cpfBenef.length !== 11) {
                if (!confirm('O CPF do paciente não possui 11 dígitos. No Receita Saúde o CPF é obrigatório. Deseja exportar mesmo assim?')) return;
            }

            const linha = montarLinhaCSVReceitaSaude(pg);
            const nomeLimpo = (pac.nome || 'Paciente').replace(/[^a-zA-Z0-9]/g, '_');
            dispararDownloadCSV([linha], `ReceitaSaude_${nomeLimpo}_${pg.data_pagamento || 'sessao'}.csv`);
            definirEmitidoReceitaSaude(pg.id, true);
            atualizarUICamposModalReceitaIndividual();
            aplicarFiltrosCobrancas();
        }

        function baixarReciboPDFDoModalAtual() {
            if (!pagamentoReceitaSaudeAtualId) return;
            gerarReciboPDF(pagamentoReceitaSaudeAtualId);
        }

        function abrirModalExportarReceitaSaude() {
            const selectMes = document.getElementById('mesLoteReceitaSaude');
            const basePagos = obterPagamentosFiltradosPorPsicologa().filter(pg => pg.status === 'Pago');

            if (selectMes) {
                const mesesSet = new Set();
                basePagos.forEach(pg => {
                    const m = (pg.data_pagamento || pg.data_vencimento || '').slice(0, 7);
                    if (m && m.length === 7) mesesSet.add(m);
                });
                const mesAtual = obterChaveDiaLocal().slice(0, 7);
                mesesSet.add(mesAtual);

                const mesesOrdenados = Array.from(mesesSet).sort().reverse();
                selectMes.innerHTML = `<option value="todos">Todos os meses (${basePagos.length} pagos)</option>` +
                    mesesOrdenados.map(m => {
                        const [ano, mes] = m.split('-');
                        const qtd = basePagos.filter(pg => (pg.data_pagamento || pg.data_vencimento || '').slice(0, 7) === m).length;
                        return `<option value="${m}">${mes}/${ano} (${qtd} ${qtd === 1 ? 'pago' : 'pagos'})</option>`;
                    }).join('');

                const temNoMesAtual = basePagos.some(pg => (pg.data_pagamento || pg.data_vencimento || '').slice(0, 7) === mesAtual);
                selectMes.value = temNoMesAtual ? mesAtual : 'todos';
            }

            atualizarPreviaLoteReceitaSaude();
            const modal = document.getElementById('modalReceitaSaudeLote');
            if (modal) {
                modal.classList.remove('hidden');
                modal.style.display = 'flex';
            }
        }

        function obterPagamentosPagosDoMesSelecionado() {
            const mesAno = document.getElementById('mesLoteReceitaSaude')?.value || 'todos';
            const base = obterPagamentosFiltradosPorPsicologa();
            return base.filter(pg => {
                if (pg.status !== 'Pago') return false;
                if (mesAno === 'todos') return true;
                const dtRef = (pg.data_pagamento || pg.data_vencimento || '').slice(0, 7);
                return dtRef === mesAno;
            });
        }

        function atualizarPreviaLoteReceitaSaude() {
            const listaEl = document.getElementById('listaPreviaLoteReceitaSaude');
            const resumoEl = document.getElementById('resumoContagemLoteRS');
            if (!listaEl || !resumoEl) return;

            const pagosMes = obterPagamentosPagosDoMesSelecionado();
            if (pagosMes.length === 0) {
                resumoEl.textContent = '0 pagamentos quitados neste mês';
                listaEl.innerHTML = `<div class="p-6 text-center text-xs text-[#9C8EAD] bg-[#141019] rounded-2xl border border-[#2E2538]">Nenhum pagamento com status "Pago" encontrado neste mês.</div>`;
                return;
            }

            let comCpf = 0;
            pagosMes.forEach(pg => {
                const pac = todosPacientesCache.find(p => p.id === pg.paciente_id) || {};
                if (limparCpfApenasDigitos(pac.cpf).length === 11) comCpf++;
            });

            resumoEl.innerHTML = `<span class="text-emerald-400">${pagosMes.length} pagos</span> · <span class="${comCpf === pagosMes.length ? 'text-emerald-300' : 'text-amber-300'}">${comCpf}/${pagosMes.length} com CPF válido</span>`;

            listaEl.innerHTML = pagosMes.map(pg => {
                const pac = todosPacientesCache.find(p => p.id === pg.paciente_id) || pg.pacientes || {};
                const cpfLimpo = limparCpfApenasDigitos(pac.cpf);
                const temCpfValido = cpfLimpo.length === 11;
                const emitido = foiEmitidoReceitaSaude(pg.id);

                return `
                    <div class="p-3 rounded-xl bg-[#141019] border border-[#2E2538] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="font-bold text-white">${escapeHtml(pac.nome || 'Paciente')}</span>
                                <span class="text-emerald-400 font-bold">${formatarBRL(pg.valor)}</span>
                                <span class="text-[#9C8EAD]">(${formatarDataDDMMAAAA(pg.data_pagamento || pg.data_vencimento)})</span>
                                ${emitido ? `<span class="px-2 py-0.5 rounded-full text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30">🏛️ Já exportado</span>` : ''}
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            ${temCpfValido
                                ? `<span class="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-mono">CPF: ${escapeHtml(cpfLimpo)}</span>`
                                : `<input type="text" id="cpfLoteInput_${pac.id}" placeholder="Digite o CPF (11 díg)" class="px-2.5 py-1 input-dark rounded-lg text-[11px] font-mono w-36 outline-none border-amber-500/40">
                                   <button type="button" onclick="salvarCpfLoteRapido('${pac.id}')" class="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-semibold">Salvar CPF</button>`
                            }
                        </div>
                    </div>
                `;
            }).join('');
        }

        async function salvarCpfLoteRapido(pacienteId) {
            const input = document.getElementById(`cpfLoteInput_${pacienteId}`);
            if (!input || !input.value.trim()) return;

            const cpfLimpo = limparCpfApenasDigitos(input.value);
            if (cpfLimpo.length !== 11) {
                alert('Informe um CPF válido com 11 números.');
                return;
            }

            const { error } = await client.from('pacientes').update({ cpf: cpfLimpo }).eq('id', pacienteId);
            if (error) {
                alert('Erro ao salvar CPF: ' + error.message);
                return;
            }

            const pac = todosPacientesCache.find(p => p.id === pacienteId);
            if (pac) pac.cpf = cpfLimpo;
            atualizarPreviaLoteReceitaSaude();
            exibirToastTempoReal('CPF salvo com sucesso!');
        }

        function baixarCSVLoteReceitaSaude() {
            const pagosMes = obterPagamentosPagosDoMesSelecionado();
            if (pagosMes.length === 0) {
                alert('Não há pagamentos quitados no mês selecionado para exportar.');
                return;
            }

            const semCpf = pagosMes.filter(pg => {
                const pac = todosPacientesCache.find(p => p.id === pg.paciente_id) || {};
                return limparCpfApenasDigitos(pac.cpf).length !== 11;
            });

            if (semCpf.length > 0) {
                if (!confirm(`Existem ${semCpf.length} pagamento(s) sem CPF de 11 dígitos preenchido. Deseja exportar o arquivo mesmo assim?`)) {
                    return;
                }
            }

            const linhas = pagosMes.map(pg => montarLinhaCSVReceitaSaude(pg));
            const mesAno = document.getElementById('mesLoteReceitaSaude')?.value || 'lote';
            dispararDownloadCSV(linhas, `ReceitaSaude_CarneLeao_${mesAno}.csv`);

            pagosMes.forEach(pg => definirEmitidoReceitaSaude(pg.id, true));
            atualizarPreviaLoteReceitaSaude();
            aplicarFiltrosCobrancas();
            exibirToastTempoReal(`Lote de ${pagosMes.length} recibos exportado no padrão Receita Saúde!`);
        }

        async function gerarReciboPDF(pagamentoId) {
            const pg = todosPagamentosCache.find(item => item.id === pagamentoId);
            if (!pg) return;

            const pac = todosPacientesCache.find(item => item.id === pg.paciente_id) || pg.pacientes || {};
            const psi = todosUsuariosCache.find(u => u.id === pac.psicologa_id) || usuarioAtualPerfil || {};

            const nomePsi = psi.nome || obterNomeExibicaoUsuario();
            const crpPsi = psi.crp || 'Não informado';
            const nomePac = pac.nome || 'Paciente';
            const temResponsavel = pac.responsavel_nome && pac.responsavel_nome.trim() !== '';

            const pagadorNome = temResponsavel ? pac.responsavel_nome.trim() : nomePac;
            const pagadorCpf = temResponsavel
                ? (pac.responsavel_cpf ? 'CPF: ' + pac.responsavel_cpf : 'CPF não informado')
                : (pac.cpf ? 'CPF: ' + pac.cpf : 'CPF não informado');

            const detalheBeneficiario = temResponsavel
                ? ', referente a sessões de psicoterapia / atendimento psicológico prestadas a ' + nomePac + (pac.cpf ? ' (CPF: ' + pac.cpf + ')' : '')
                : ', referente a sessões de psicoterapia / atendimento psicológico';

            const valorFormatado = formatarBRL(pg.valor);
            const dataRecibo = pg.data_pagamento
                ? new Date(pg.data_pagamento + 'T00:00:00').toLocaleDateString('pt-BR')
                : new Date().toLocaleDateString('pt-BR');

            const container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.left = '-9999px';
            container.style.width = '700px';
            container.style.background = '#ffffff';
            container.style.padding = '40px';
            container.style.fontFamily = 'Georgia, serif';
            container.style.color = '#1f1a24';

            container.innerHTML = `
                <div style="border: 1.5px solid #3f3152; border-radius: 12px; padding: 36px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ddd; padding-bottom: 16px; margin-bottom: 24px;">
                        <div>
                            <div style="font-size: 22px; font-weight: bold; color: #3f3152; letter-spacing: 1px;">RECIBO DE ATENDIMENTO PSICOLÓGICO</div>
                            <div style="font-size: 12px; color: #666; margin-top: 4px;">Emitido via Gnoth · Gestão Clínica</div>
                        </div>
                        <div style="font-size: 20px; font-weight: bold; background: #f5f0fa; padding: 8px 16px; border-radius: 8px; color: #3f3152;">${valorFormatado}</div>
                    </div>
                    <p style="font-size: 15px; line-height: 1.8; margin-bottom: 36px; text-align: justify;">Recebi de <strong>${pagadorNome}</strong> (${pagadorCpf}) a importância de <strong>${valorFormatado}</strong>${detalheBeneficiario} realizadas até a presente data.</p>
                    <p style="font-size: 14px;">Data de quitação: <strong>${dataRecibo}</strong></p>
                    <div style="margin-top: 56px; text-align: center;">
                        <div style="border-top: 1px solid #333; width: 280px; margin: 0 auto 8px auto;"></div>
                        <strong>${nomePsi}</strong><br>
                        <span style="font-size: 13px; color: #444;">Psicóloga(o) · CRP: ${crpPsi}</span>
                    </div>
                    <div style="font-size: 12px; color: #666; margin-top: 32px; text-align: center;">Documento válido para fins de comprovação de despesas médicas e reembolso.</div>
                </div>
            `;

            document.body.appendChild(container);

            try {
                const canvas = await html2canvas(container, { scale: 2, useCORS: true });
                const imgData = canvas.toDataURL('image/png');

                const { jsPDF } = window.jspdf;
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

                pdf.addImage(imgData, 'PNG', 0, 10, pdfWidth, pdfHeight);
                
                const dataArquivoStr = pg.data_pagamento ? pg.data_pagamento.split('-').reverse().join('-') : 'data';
                const nomeArquivoLimpo = `Recibo_${pagadorNome.replace(/[^a-zA-Z0-9]/g, '_')}_${dataArquivoStr}.pdf`;
                
                pdf.save(nomeArquivoLimpo);
            } catch (err) {
                alert("Erro ao gerar o PDF. Tente novamente.");
            } finally {
                document.body.removeChild(container);
            }
        }

        function exportarProntuarioPDF(registroUnicoId = null) {
            if (!pacienteSelecionadoId) return;
            const pac = todosPacientesCache.find(p => p.id === pacienteSelecionadoId);
            if (!pac) return;

            const psi = todosUsuariosCache.find(u => u.id === pac.psicologa_id) || usuarioAtualPerfil || {};
            const nomePsi = psi.nome || obterNomeExibicaoUsuario();
            const crpPsi = psi.crp || 'Não informado';
            const abordagemUtilizada = pac.abordagem || psi.abordagem || 'Não informada';

            let registrosFiltrados = [...historicoProntuarioAtualCache];
            let subtituloEscopo = 'Prontuário Completo';

            if (registroUnicoId) {
                registrosFiltrados = registrosFiltrados.filter(r => r.id === registroUnicoId);
                subtituloEscopo = 'Registro Individual de Atendimento';
            } else {
                const idsMarcados = Array.from(document.querySelectorAll('.chk-evolucao-pdf:checked')).map(cb => cb.value);
                if (idsMarcados.length > 0) {
                    registrosFiltrados = registrosFiltrados.filter(r => idsMarcados.includes(r.id));
                    subtituloEscopo = `Extrato Selecionado (${idsMarcados.length} ${idsMarcados.length === 1 ? 'registro' : 'registros'})`;
                }
            }

            const nascFormatado = pac.data_nascimento
                ? new Date(pac.data_nascimento + 'T00:00:00').toLocaleDateString('pt-BR')
                : 'Não informada';
            const lgpdTexto = pac.lgpd_aceito_em
                ? 'Consentimento registrado em ' + new Date(pac.lgpd_aceito_em).toLocaleString('pt-BR')
                : 'Consentimento pendente de registro digital';

            const evolucoesCronologicas = registrosFiltrados.reverse();

            const blocosEvolucao = evolucoesCronologicas.length === 0
                ? '<p style="color:#666; font-style:italic;">Nenhuma evolução clínica selecionada ou registrada.</p>'
                : evolucoesCronologicas.map((reg) => {
                    const indexOriginal = historicoProntuarioAtualCache.findIndex(item => item.id === reg.id);
                    const numeroReal = indexOriginal !== -1 ? (historicoProntuarioAtualCache.length - indexOriginal) : 1;
                    const dt = new Date(reg.criado_em).toLocaleString('pt-BR');
                    return '<div class="evolucao">' +
                        '<div class="evo-header"><strong>Registro #' + numeroReal + '</strong> · ' + dt + ' · Responsável: ' + escapeHtml(reg.autor_email || nomePsi) + '</div>' +
                        '<div class="evo-body">' + escapeHtml(reg.conteudo).replace(/\n/g, '<br>') + '</div>' +
                    '</div>';
                }).join('');

            const htmlProntuario = [
                '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">',
                '<title>Prontuário Psicológico - ' + escapeHtml(pac.nome) + '</title>',
                '<style>',
                'body{font-family:Georgia,serif;color:#1f1a24;padding:40px;max-width:800px;margin:0 auto;line-height:1.6;}',
                '.header{border-bottom:2px solid #3f3152;padding-bottom:16px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-end;}',
                '.title{font-size:20px;font-weight:bold;color:#3f3152;}',
                '.sub{font-size:11px;color:#666;text-transform:uppercase;letter-spacing:1px;}',
                '.ficha{background:#f8f6fa;border:1px solid #e2d9eb;border-radius:10px;padding:18px;margin-bottom:24px;font-size:13px;}',
                '.ficha-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}',
                '.evolucao{border:1px solid #ddd;border-left:4px solid #5F4A78;border-radius:8px;padding:14px 18px;margin-bottom:14px;page-break-inside:avoid;}',
                '.evo-header{font-size:12px;color:#4a3b5c;border-bottom:1px solid #eee;padding-bottom:6px;margin-bottom:8px;}',
                '.evo-body{font-size:13.5px;color:#222;text-align:justify;}',
                '.footer{margin-top:40px;padding-top:16px;border-top:1px solid #ccc;font-size:11px;color:#555;text-align:center;}',
                '@media print{.no-print{display:none;}}',
                '</style></head><body>',
                '<div class="no-print" style="text-align:right;margin-bottom:16px;">',
                '<button onclick="window.print()" style="background:#5F4A78;color:#fff;border:none;padding:10px 18px;border-radius:8px;cursor:pointer;font-weight:bold;">🖨️ Imprimir / Salvar PDF (CFP)</button>',
                '</div>',
                '<div class="header"><div>',
                '<div class="sub">Documento Sigiloso · Resolução CFP nº 01/2009 · ' + escapeHtml(subtituloEscopo) + '</div>',
                '<div class="title">PRONTUÁRIO DE ATENDIMENTO PSICOLÓGICO</div>',
                '</div><div style="text-align:right;font-size:12px;">Emitido em: ' + new Date().toLocaleDateString('pt-BR') + '</div></div>',
                '<div class="ficha"><div class="ficha-grid">',
                '<div><strong>Paciente:</strong> ' + escapeHtml(pac.nome) + '</div>',
                '<div><strong>CPF:</strong> ' + escapeHtml(pac.cpf || 'Não informado') + '</div>',
                '<div><strong>Nascimento:</strong> ' + nascFormatado + '</div>',
                '<div><strong>Contato:</strong> ' + escapeHtml(pac.whatsapp || 'Não informado') + '</div>',
                (pac.responsavel_nome ? '<div><strong>Responsável:</strong> ' + escapeHtml(pac.responsavel_nome) + '</div><div><strong>CPF Responsável:</strong> ' + escapeHtml(pac.responsavel_cpf || '—') + '</div>' : ''),
                '<div><strong>Profissional:</strong> ' + escapeHtml(nomePsi) + ' (CRP: ' + escapeHtml(crpPsi) + ')</div>',
                '<div><strong>Abordagem Utilizada:</strong> ' + escapeHtml(abordagemUtilizada) + '</div>',
                '<div style="grid-column:1/-1;margin-top:6px;padding-top:6px;border-top:1px dashed #ccc;"><strong>LGPD:</strong> ' + escapeHtml(lgpdTexto) + '</div>',
                '</div></div>',
                '<h3 style="font-size:15px;color:#3f3152;margin-bottom:14px;">Registro Cronológico de Evoluções Clínicas</h3>',
                blocosEvolucao,
                '<div class="footer">Documento confidencial protegido por sigilo profissional (Código de Ética Profissional do Psicólogo).<br>Gerado via Gnoth · Gestão Clínica</div>',
                '</body></html>'
            ].join('');

            const janela = window.open('', '_blank', 'width=850,height=700');
            janela.document.write(htmlProntuario);
            janela.document.close();
        }
