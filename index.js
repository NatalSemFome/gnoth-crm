// Scripts da página institucional (index.html)
window.addEventListener('DOMContentLoaded', () => {
    // Menu Mobile da Landing Page Institucional
    const btnMenu = document.getElementById('btnMenuMobileIndex');
    const menuMobile = document.getElementById('menuMobileIndex');

    if (btnMenu && menuMobile) {
        btnMenu.addEventListener('click', () => {
            menuMobile.classList.toggle('hidden');
        });

        menuMobile.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                menuMobile.classList.add('hidden');
            });
        });
    }

    // Acordeão de Perguntas Frequentes (FAQ)
    document.querySelectorAll('.faq-item').forEach(item => {
        item.addEventListener('click', () => {
            const answer = item.querySelector('.faq-answer');
            const icon = item.querySelector('.faq-icon');
            if (!answer) return;

            const isHidden = answer.classList.contains('hidden');
            answer.classList.toggle('hidden', !isHidden);
            if (icon) {
                icon.textContent = isHidden ? '−' : '+';
            }
        });
    });
});
