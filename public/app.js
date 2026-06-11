/**
 * app.js - Comportamento Interativo de Fornadas, Mapa e Navegação para a Padaria
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Inicializar Ícones do Lucide
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // 2. Controle de Menu Mobile / Tablet (Drawer Estendido)
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  const menuIconClosed = document.getElementById('menu-icon-closed');
  const menuIconOpened = document.getElementById('menu-icon-opened');
  const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');

  function toggleMobileMenu() {
    const isOpened = !mobileMenu.classList.contains('hidden');
    
    if (isOpened) {
      // Fechar
      mobileMenu.classList.add('opacity-0', '-translate-y-4');
      setTimeout(() => {
        mobileMenu.classList.add('hidden');
      }, 150);
      menuIconClosed.classList.remove('hidden');
      menuIconOpened.classList.add('hidden');
    } else {
      // Abrir
      mobileMenu.classList.remove('hidden');
      // Forçar repaint para transição funcionar
      mobileMenu.offsetHeight;
      mobileMenu.classList.remove('opacity-0', '-translate-y-4');
      menuIconClosed.classList.add('hidden');
      menuIconOpened.classList.remove('hidden');
    }
  }

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', toggleMobileMenu);
  }

  // Fechar menu mobile ao clicar em qualquer item de navegação
  mobileNavLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
        toggleMobileMenu();
      }
    });
  });

  // 3. Efeito de Scroll no Header Superior (Nav Solid Background)
  const mainNav = document.getElementById('main-nav');
  window.addEventListener('scroll', () => {
    if (mainNav) {
      if (window.scrollY > 50) {
        // Ao rolar, adiciona fundo sólido e sombra refinada
        mainNav.classList.add('bg-cream-900/95', 'backdrop-blur-md', 'shadow-xl', 'border-b', 'border-rust-dark/30', 'py-3');
        mainNav.classList.remove('py-4');
      } else {
        // No topo, fica transparente sobre a capa
        mainNav.classList.remove('bg-cream-900/95', 'backdrop-blur-md', 'shadow-xl', 'border-b', 'border-rust-dark/30', 'py-3');
        mainNav.classList.add('py-4');
      }
    }
  });


  // 4. SISTEMA DO MONITOR DO FORNO EM TEMPO REAL
  // Horários fixos das fornadas: 06h00 e 17h00 todos os dias.
  const FORNADAS = [
    { hour: 6, minute: 0, label: '06:00' },
    { hour: 17, minute: 0, label: '17:00' }
  ];

  const quickStatusEl = document.getElementById('oven-quick-status');
  const clockEl = document.getElementById('countdown-clock');
  const labelEl = document.getElementById('countdown-label');
  
  const pillStatusEl = document.getElementById('oven-visual-status-pill');
  const pillIndicator = document.getElementById('oven-pill-indicator');
  const pillText = document.getElementById('oven-pill-text');

  const tempDisplay = document.getElementById('oven-temp-display');
  const progressBar = document.getElementById('oven-progressbar');
  
  const statusDetailedTitle = document.getElementById('status-detailed-title');
  const statusDetailedDesc = document.getElementById('status-detailed-desc');
  const oventIconContainer = document.getElementById('oven-icon-container');
  const ovenCoreIcon = document.getElementById('oven-core-icon');

  function updateOvenMonitor() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentSecond = now.getSeconds();

    // Encontrar próxima fornada
    let nextFornadaDate = null;
    let selectedFornadaInfo = null;

    for (let f of FORNADAS) {
      const fDate = new Date(now);
      fDate.setHours(f.hour, f.minute, 0, 0);
      
      if (fDate > now) {
        nextFornadaDate = fDate;
        selectedFornadaInfo = f;
        break;
      }
    }

    // Se passou de todas do dia corrente, a próxima é a primeira do dia seguinte
    if (!nextFornadaDate) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      nextFornadaDate = new Date(tomorrow);
      nextFornadaDate.setHours(FORNADAS[0].hour, FORNADAS[0].minute, 0, 0);
      selectedFornadaInfo = FORNADAS[0];
    }

    // Calcular diferença de milissegundos
    const diffMs = nextFornadaDate - now;
    
    // Converter para H, M, S
    const hoursRaw = Math.floor(diffMs / (1000 * 60 * 60));
    const minutesRaw = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const secondsRaw = Math.floor((diffMs % (1000 * 60)) / 1000);

    // Formatação de string de relógio
    const hStr = String(hoursRaw).padStart(2, '0');
    const mStr = String(minutesRaw).padStart(2, '0');
    const sStr = String(secondsRaw).padStart(2, '0');

    if (clockEl) {
      clockEl.textContent = `${hStr}:${mStr}:${sStr}`;
    }

    if (labelEl && selectedFornadaInfo) {
      labelEl.textContent = `Até a próxima fornada quentinha das ${selectedFornadaInfo.label}`;
    }

    // ---- CALCULAR ESTADO ATUAL DO FORNO ----
    // Vamos calcular com base nos minutos totais para cada fornada do dia.
    // 1- Aquecendo (60 mins antes da fornada até 45 mins antes): Temperatura sobe de 100°C a 180°C
    // 2- Assando (45 mins antes até o horário exato): Temperatura sobe de 180°C a 240°C
    // 3- Quentinho Agora (Hora exata até 60 minutos depois): Temperatura cai de 240°C a 70°C (Mesa de conservação)
    // 4- Preparando próxima fornada (Qualquer outro horário): Temperatura constante 50°C

    let currentState = 'idling'; // idling | heating | baking | hot_now
    let temp = 50; 
    let progressPercent = 10;
    let statusText = 'Preparando Fornadas';
    let detailedTitle = 'Fornos em Espera';
    let detailedDesc = 'Nossos panificadores estão descansando as massas biológicas ou limpando o Lastro. Os fornos mantêm uma leve caloria em espera constante.';
    let iconColorClass = 'text-rust-light';
    let glowColorClass = 'bg-rust-light/10';
    let pillColorClass = 'bg-yellow-500';

    // Checar relação com cada fornada diária
    FORNADAS.forEach(f => {
      // Converter horas/minutos atuais e da fornada em minutos totais desde a meia-noite
      const nowTotalMins = currentHour * 60 + currentMinute;
      const fornadaTotalMins = f.hour * 60 + f.minute;
      
      const diffMins = nowTotalMins - fornadaTotalMins;

      // Fase 3: Quentinho Agora! (De diffMins = 0 até diffMins = +60 minutos)
      if (diffMins >= 0 && diffMins <= 60) {
        currentState = 'hot_now';
        // Reduz de 240C até 70C gradualmente
        temp = Math.round(240 - ((diffMins / 60) * (240 - 70)));
        progressPercent = Math.round(100 - (diffMins / 60) * 80); // cai de 100% a 20%
        statusText = 'Pão Quentinho Agora!';
        detailedTitle = 'Saindo do Forno Agora!';
        detailedDesc = 'Fornada quentinha concluída de Pães Franceses crocantes! Venha buscar enquanto a casca ainda está cantando e estalando de fresca.';
        iconColorClass = 'text-green-500';
        glowColorClass = 'bg-green-500/10';
        pillColorClass = 'bg-green-500 animate-pulse';
      }
      
      // Fase 1: Fornos Aquecendo (De diffMins = -60 até -45 minutos)
      else if (diffMins >= -60 && diffMins < -45) {
        currentState = 'heating';
        const ratio = (diffMins + 60) / 15; // 0 a 1
        temp = Math.round(100 + ratio * 80); // 100C a 180C
        progressPercent = Math.round(10 + ratio * 40); // 10% a 50%
        statusText = 'Fornos Aquecendo';
        detailedTitle = 'Aquecimento de Lastro';
        detailedDesc = 'Os fornos estão sendo pré-aquecidos para atingir a caloria perfeita das cascas rústicas. Nossos padeiros estão esticando e selando os filões.';
        iconColorClass = 'text-yellow-500';
        glowColorClass = 'bg-yellow-500/20';
        pillColorClass = 'bg-yellow-400';
      }

      // Fase 2: Assando (De diffMins = -45 até 0 minutos)
      else if (diffMins >= -45 && diffMins < 0) {
        currentState = 'baking';
        const ratio = (diffMins + 45) / 45; // 0 a 1
        temp = Math.round(180 + ratio * 60); // 180C a 240C
        progressPercent = Math.round(50 + ratio * 50); // 50% a 100%
        statusText = 'Forno Assando Pão!';
        detailedTitle = 'Cozimento Intenso';
        detailedDesc = 'Os pães franceses estão dentro do forno recebendo injeção automática de vapor quente para a casca crescer dourada e vítrea!';
        iconColorClass = 'text-orange-500 animate-pulse';
        glowColorClass = 'bg-orange-500/30';
        pillColorClass = 'bg-red-500 animate-bounce';
      }
    });

    // Atualizar UI com base nos valores computados
    if (quickStatusEl) {
      if (currentState === 'hot_now') {
        quickStatusEl.innerHTML = `<span class="text-green-600 font-bold">● PÃES QUENTINHOS NA MESA!</span> Acabou de sair fornada fresca. Corra para aproveitar!`;
      } else if (currentState === 'baking') {
        quickStatusEl.innerHTML = `<span class="text-orange-500 font-bold">● ASSANDO AGORA...</span> Pães estão no forno crescendo. Forno a ${temp}°C!`;
      } else if (currentState === 'heating') {
        quickStatusEl.innerHTML = `<span class="text-yellow-600 font-bold">● PREPARATIVOS:</span> Fornos aquecendo a ${temp}°C para a próxima fornada garantida.`;
      } else {
        // Encontrar a hora da fornada encontrada de forma legível
        const labelHour = selectedFornadaInfo ? selectedFornadaInfo.label : '06:00';
        quickStatusEl.innerHTML = `Próxima fornada de Pão Francês com casca crocante programada para as <strong class="text-rust-dark font-serif font-bold">${labelHour}</strong>.`;
      }
    }

    // Atualizar Pilula Visual Central do monitor
    if (pillText) {
      pillText.textContent = statusText;
    }
    if (pillIndicator) {
      // Limpar classes antigas
      pillIndicator.className = 'w-2.5 h-2.5 rounded-full';
      if (currentState === 'hot_now') {
        pillIndicator.classList.add('bg-green-500', 'animate-pulse');
      } else if (currentState === 'baking') {
        pillIndicator.classList.add('bg-orange-500', 'animate-ping');
      } else if (currentState === 'heating') {
        pillIndicator.classList.add('bg-yellow-400');
      } else {
        pillIndicator.classList.add('bg-rust-light');
      }
    }

    // Atualizar Temperatura Display
    if (tempDisplay) {
      tempDisplay.textContent = `${temp}°C`;
    }

    // Atualizar Progrssbar de Fornos
    if (progressBar) {
      progressBar.style.width = `${progressPercent}%`;
      // Ajustar cor da barra
      progressBar.className = 'h-full rounded-full transition-all duration-[1000ms]';
      if (currentState === 'hot_now') {
        progressBar.classList.add('bg-gradient-to-r', 'from-emerald-500', 'to-green-500');
      } else if (currentState === 'baking') {
        progressBar.classList.add('bg-gradient-to-r', 'from-orange-500', 'to-red-650', 'bg-red-600');
      } else if (currentState === 'heating') {
        progressBar.classList.add('bg-gradient-to-r', 'from-amber-400', 'to-yellow-500');
      } else {
        progressBar.classList.add('bg-[#A1744B]');
      }
    }

    // Detalhes textuais inferiores
    if (statusDetailedTitle) {
      statusDetailedTitle.textContent = detailedTitle;
    }
    if (statusDetailedDesc) {
      statusDetailedDesc.textContent = detailedDesc;
    }

    // Ajustar Ícones e Cores
    if (oventIconContainer) {
      oventIconContainer.className = 'w-20 h-20 rounded-full flex items-center justify-center mb-4 relative transition-all duration-500';
      // Limpar os glows anteriores pela classe principal
      if (currentState === 'hot_now') {
        oventIconContainer.classList.add('bg-green-500/5', 'border-green-500/30');
      } else if (currentState === 'baking') {
        oventIconContainer.classList.add('bg-orange-500/10', 'border-orange-500/35', 'scale-110');
      } else if (currentState === 'heating') {
        oventIconContainer.classList.add('bg-yellow-400/5', 'border-yellow-400/25');
      } else {
        oventIconContainer.classList.add('bg-rust-light/5', 'border-rust-light/20');
      }
    }

    if (ovenCoreIcon && typeof lucide !== 'undefined') {
      // Ajustar ícone correspondente
      let iconName = 'coffee';
      if (currentState === 'hot_now') {
        iconName = 'chef-hat';
        ovenCoreIcon.className = 'w-10 h-10 text-green-500';
      } else if (currentState === 'baking') {
        iconName = 'flame';
        ovenCoreIcon.className = 'w-10 h-10 text-orange-500 animate-bounce';
      } else if (currentState === 'heating') {
        iconName = 'thermometer-sun';
        ovenCoreIcon.className = 'w-10 h-10 text-yellow-500 animate-pulse';
      } else {
        iconName = 'cookie';
        ovenCoreIcon.className = 'w-10 h-10 text-rust-light';
      }
      ovenCoreIcon.setAttribute('data-lucide', iconName);
      lucide.createIcons({
        attrs: {
          class: ovenCoreIcon.className
        }
      });
    }
  }

  // Inicializar relógio imediatamente e manter atualizando a cada 1 segundo
  updateOvenMonitor();
  setInterval(updateOvenMonitor, 1000);


  // 5. INTERATIVIDADE DO MAPA SIMULADO (Controle de Zoom do Canvas)
  const mapZoomInBtn = document.getElementById('map-zoom-in');
  const mapZoomOutBtn = document.getElementById('map-zoom-out');
  const simulatedMap = document.getElementById('simulated-map');

  let mapZoomLevel = 1.0;

  function updateMapZoom() {
    if (simulatedMap) {
      const mapBackgrounds = simulatedMap.querySelectorAll('.absolute');
      mapBackgrounds.forEach(bg => {
        if (bg.classList.contains('absolute') && !bg.classList.contains('animate-bounce-custom')) {
          // Aplicar escala suave de zoom utilizando transformação CSS
          bg.style.transform = `scale(${mapZoomLevel})`;
          bg.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
        }
      });
    }
  }

  if (mapZoomInBtn) {
    mapZoomInBtn.addEventListener('click', () => {
      if (mapZoomLevel < 1.6) {
        mapZoomLevel += 0.15;
        updateMapZoom();
      }
    });
  }

  if (mapZoomOutBtn) {
    mapZoomOutBtn.addEventListener('click', () => {
      if (mapZoomLevel > 0.75) {
        mapZoomLevel -= 0.15;
        updateMapZoom();
      }
    });
  }

});
