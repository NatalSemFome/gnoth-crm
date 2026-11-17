# 🧠 Gnoth · SaaS & CRM de Gestão Clínica para Psicólogos

> *"Gnóthi seautón" — Conhece-te a ti mesmo.*

O **Gnoth** é uma plataforma SaaS completa (CRM, Prontuário Eletrônico, Gestão Financeira Fiscal e Construtor de Landing Pages) desenvolvida especificamente para **psicólogos clínicos autônomos e clínicas de psicologia** no Brasil.

🔗 **Aplicação em Produção:** [https://www.gnoth.com.br](https://www.gnoth.com.br)

---

## 🎯 O Problema Real que o Projeto Resolve

Psicólogos clínicos enfrentam diariamente três grandes gargalos operacionais e regulatórios:
1. **Exigência Documental do CFP (Resolução CFP nº 01/2009 & LGPD):** Anotações em blocos de notas ou papéis soltos não atendem aos critérios de guarda segura, sigilo e rastreabilidade cronológica.
2. **Obrigatoriedade do Receita Saúde / Carnê-Leão Web:** Lançar manualmente dezenas de recibos mensais no portal e-CAC da Receita Federal consome horas de trabalho.
3. **Captação e Triagem Descentralizada:** Leads vindos do Instagram ou Google Ads se perdem no WhatsApp sem histórico estruturado.

---

## ✨ Principais Funcionalidades Desenvolvidas

### 1. 🎙️ Prontuário Eletrônico Auditável (Padrão CFP) + Ditado por Voz
- Registro cronológico imutável de evoluções clínicas com carimbo de data, hora e profissional responsável.
- **Reconhecimento de Voz Nativo (Web Speech API):** Permite ditar a evolução da sessão em tempo real.
- **Exportação Seletiva em PDF:** Geração de prontuário completo ou extrato de sessões selecionadas formatado nos padrões do Conselho Federal de Psicologia.

### 2. 🏛️ Integração Fiscal com Receita Saúde / Carnê-Leão Web (`.CSV` Oficial)
- **Exportador em Lote (`.CSV`):** Gera o arquivo estruturado nas 12 colunas oficiais exigidas pela Receita Federal (Código `R01.001.001` · Ocupação `255 - Psicólogo`), diferenciando automaticamente o **CPF do Pagador (Responsável Financeiro)** do **CPF do Beneficiário (Paciente)**.
- **Ponte Rápida 1-Clique & Controle de Emissão:** Validação instantânea de CPFs faltantes, cópia rápida para o app *Receita Federal*, emissão de Recibo em PDF (`jsPDF` + `html2canvas`) e selo de conciliação `🏛️ Receita OK`.

### 3. 🌐 Construtor de Landing Page Multi-Tenant (`/lp/:slug`)
- Cada profissional (com o módulo ativo) possui seu próprio site de alta conversão em `gnoth.com.br/lp/NomeDoProfissional`.
- Painel visual dentro do CRM para personalizar **paleta de cores (CSS Variables dinâmicas)**, foto profissional (Supabase Storage), CRP, textos de apresentação e WhatsApp.
- Formulário de acolhimento integrado diretamente à aba de **Triagens** do profissional.

### 4. 🗓️ Agenda Recorrente Multi-Profissional
- Criação de sessões únicas, semanais ou quinzenais (pacotes de 4, 8 ou 12 sessões) com geração automática de cobranças vinculadas.
- Algoritmo de detecção de conflitos de horário isolado por profissional (`psicologa_id`), permitindo que múltiplos psicólogos de uma mesma clínica atendam no mesmo horário sem colisão.

### 5. ⚡ Sincronização em Tempo Real & RBAC (Controle de Acesso em Níveis)
- **Supabase Realtime (`postgres_changes`) + Polling Adaptativo:** Novas triagens e confirmações financeiras atualizam a interface ao vivo sem necessidade de recarregar a página (F5).
- **Níveis de Acesso (`Admin` vs `Psicólogo`):** Isolamento de queries no banco de dados por profissional, painel de gestão de equipe, controle de assinaturas (`Trial`, `Individual`, `Individual + LP`, `Clínica`) e criação de novos usuários sem encerrar a sessão ativa do administrador.
- **Roteamento SPA com URLs Limpas:** Navegação instantânea via History API (`/dashboard`, `/agenda`, `/clientes`, `/pagamentos`, `/minha-lp`, `/perfil`) combinada com Rewrites na Vercel.

---

## 🛠️ Tecnologias Utilizadas

- **Front-end:** HTML5 Semântico, CSS3 (Custom Properties / Variáveis Dinâmicas), Tailwind CSS, JavaScript (ES6+ Vanilla SPA Router, Web Speech API).
- **Back-end as a Service (BaaS):** Supabase (PostgreSQL, Auth, Realtime WebSockets, Storage).
- **Geração de Documentos & Arquivos:** `jsPDF`, `html2canvas`, Gerador `.CSV` UTF-8 BOM compatível com e-CAC / Receita Federal.
- **Deploy & Infraestrutura:** Vercel (Edge Rewrites & Clean URLs).

---

## 📂 Estrutura do Projeto

```text
├── index.html        # Landing Page comercial do SaaS Gnoth
├── index.css         # Estilos da página institucional
├── index.js          # Interações e FAQ da página institucional
├── app.html          # Aplicação principal (SPA do CRM e Prontuário)
├── app.css           # Tema Dark Plum e estilização da aplicação
├── app.js            # Core do CRM (Auth, Router, Agenda, Prontuário, Receita Saúde, Admin)
├── lp.html           # Template dinâmico das Landing Pages dos psicólogos
├── lp.css            # Variáveis CSS dinâmicas personalizáveis por profissional
├── lp.js             # Motor de renderização multi-cliente e captura de triagens
└── vercel.json       # Configuração de rotas limpas e rewrites (/lp/:slug e rotas do app)
```

---

## 👨‍💻 Autor

Desenvolvido por **Matheus Brito**.
