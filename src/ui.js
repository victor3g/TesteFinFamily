// src/ui.js
import { 
    DEFAULT_CHILD_DATA, BADGES, COOLDOWN_DURATION_MS, DONATION_TARGET, 
    SHOP_ICONS, SHOP_EMOTIONS, STANDARD_EMOTIONS, PET_CHARACTERS, 
    DEFAULT_THEME_COLORS 
} from './config.js';
import { saveChildData } from './supabase-client.js';
import { launchGame } from './game.js';
import { 
    currentUserId, childParentId, userData, userType, parentId, 
    addTransaction, checkBadges, awardBadge 
} from './main.js';

// --- Elementos do DOM (Cache) ---
const userNameEl = document.getElementById('user-name');
const coinCountEl = document.getElementById('coin-count');
const tasksDoneEl = document.getElementById('tasks-done');
const tasksTotalEl = document.getElementById('tasks-total');
const progressBarEl = document.getElementById('progress-bar');
const modalEl = document.getElementById('main-modal');
const modalTitleEl = document.getElementById('modal-title');
const modalBodyEl = document.getElementById('modal-body');
const profileIconContainer = document.getElementById('profile-icon-container');
const piggyCharEl = document.getElementById('piggy-character');
const piggyGreetingEl = document.getElementById('piggy-greeting');
const piggyContainerEl = document.getElementById('animated-piggy-container');


// --- UI GERAL & MODAIS ---

function convertMarkdownToHtml(text) {
    if (typeof text !== 'string') return text;
    return text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
}

export function showModal(title, message) {
    if (modalTitleEl) modalTitleEl.textContent = title;
    if (modalBodyEl) modalBodyEl.innerHTML = convertMarkdownToHtml(message);
    modalEl?.classList.remove('hidden');
}

export function hideModal() {
    modalEl?.classList.add('hidden');
    // Se sair do modal enquanto o jogo está aberto, o jogo deve parar
    const gameModal = document.getElementById('game-modal');
    if (gameModal && !gameModal.classList.contains('hidden')) {
        // Chama a função global de gameOver
        window.gameOver(); 
    }
}

document.getElementById('modal-close-btn')?.addEventListener('click', hideModal);

// --- FUNÇÕES DE MASCOTE / UX ---
let greetingTimeout;
let reactionTimeout;

export function showGreeting() {
    clearTimeout(greetingTimeout);
    if (piggyGreetingEl && userType === 'Child') {
        piggyGreetingEl.textContent = `👋 Olá, ${userData.name}!`;
        piggyGreetingEl.classList.remove('opacity-0');
        
        greetingTimeout = setTimeout(() => {
            piggyGreetingEl.classList.add('opacity-0');
        }, 4000);
    }
}

const REACTION_MESSAGES = [
    "Opa! Fui tocado!",
    "Eba! Mais moedas!",
    "Toca de novo! ✨",
    "Pronto para poupar?",
    "Uau! 😊",
];

export function triggerReaction() {
    if (!piggyCharEl || userType !== 'Child') return;
    
    piggyCharEl.classList.remove('piggy-reacting');
    void piggyCharEl.offsetWidth; 
    piggyCharEl.classList.add('piggy-reacting');

    clearTimeout(reactionTimeout);
    const randomMsg = REACTION_MESSAGES[Math.floor(Math.random() * REACTION_MESSAGES.length)];
    piggyGreetingEl.textContent = randomMsg;
    piggyGreetingEl.classList.remove('opacity-0');

    reactionTimeout = setTimeout(() => {
        piggyGreetingEl.classList.add('opacity-0');
    }, 2000);
}

// --- UTILIDADES DE TEMA E ÍCONE ---

export function applyTheme(themeName, fallbackColors = DEFAULT_THEME_COLORS) {
    let theme = userData.settings?.themes?.[themeName];
    
    if (userType !== 'Child' || !theme) {
        theme = fallbackColors; 
    }

    document.body.style.setProperty('--color-start', theme.start);
    document.body.style.setProperty('--color-end', theme.end);
    
    const bodyEl = document.body;
    if (userType === 'Child' || userType === 'Parent') { 
         bodyEl.classList.add('app-gradient');
         bodyEl.classList.remove('bg-[#EDEFF2]');
    } else {
         bodyEl.classList.remove('app-gradient');
         bodyEl.classList.add('bg-[#EDEFF2]');
    }
}

export function getIconHtml(iconData, sizeClass = 'text-3xl', containerSize = 'w-10 h-10') {
    if (!iconData || !iconData.value) {
        iconData = DEFAULT_CHILD_DATA.profileIcon;
    }

    const placeholder = `<div class="${containerSize} rounded-full overflow-hidden flex items-center justify-center bg-gray-300 text-white"><i class="fa-solid fa-user"></i></div>`;

    let content;
    if (iconData.type === 'fa-icon') {
        content = `<i class="fa-solid ${iconData.value} ${sizeClass} text-gray-500"></i>`;
    } else if (iconData.type === 'emoji') {
        content = `<span class="${sizeClass}">${iconData.value}</span>`;
    } else if (iconData.type === 'image-data') {
        content = `<img src="${iconData.value}" alt="Perfil" class="w-full h-full object-cover">`;
        return `<div class="${containerSize} rounded-full overflow-hidden profile-placeholder flex items-center justify-center">${content}</div>`;
    } else {
        return placeholder;
    }
    
    return `<div class="${containerSize} rounded-full overflow-hidden profile-placeholder flex items-center justify-center">${content}</div>`;
}

// --- FUNÇÃO CENTRAL DE ATUALIZAÇÃO DA UI ---

function getRemainingCooldownTime() {
     const remainingMs = userData.gameCooldownEndTime - Date.now();
    if (remainingMs <= 0) return null;

    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);

    let parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}min`);
    if (hours === 0 && minutes === 0 || parts.length === 0) {
        parts.push(`${seconds}s`);
    }

    return parts.join(' ');
}

export function isGameOnCooldown() {
    return userData.gameCooldownEndTime > Date.now();
}

export function updateUI() {
    if (userType !== 'Child') return;

    userNameEl.textContent = userData.name;
    coinCountEl.textContent = userData.coins;
    
    // Atualiza Ícones, Emoção e Mascote
    profileIconContainer.innerHTML = getIconHtml(userData.profileIcon, 'text-4xl', 'w-16 h-16');

    if (piggyCharEl) {
         piggyCharEl.textContent = userData.currentPet?.value || '🐷'; 
    }
    document.getElementById('emotion-display-container').textContent = userData.currentEmotion.value;

    // Progresso
    const totalTasks = userData.tasks.length;
    const completedTasks = userData.tasks.filter(t => t.completed).length;
    tasksTotalEl.textContent = totalTasks;
    tasksDoneEl.textContent = completedTasks;
    const savedAmount = userData.progress.savedAmount || 0;
    const progressGoal = userData.progress.goal || 0;
    
    const progressPercent = progressGoal > 0
        ? Math.min(100, (savedAmount / progressGoal) * 100)
        : 0;
        
    progressBarEl.style.width = `${progressPercent}%`;
    document.getElementById('progress-percent').textContent = `${Math.floor(progressPercent)}%`;
    
    document.getElementById('goal-name-display').textContent = userData.progress.targetName;
    document.getElementById('goal-amount-display').textContent = `${savedAmount}/${progressGoal} moedas`;


    // Cooldown Jogo
    const ganharBtn = document.getElementById('action-ganhar');
    const ganharAmount = document.getElementById('earn-amount');
    const isCooldown = isGameOnCooldown();

    if (isCooldown) {
        ganharBtn.classList.remove('bg-[#32CD32]', 'hover:bg-green-600');
        ganharBtn.classList.add('bg-gray-400', 'cursor-not-allowed');
        ganharBtn.disabled = true;
        ganharAmount.textContent = getRemainingCooldownTime();
        document.getElementById('earn-text').textContent = 'Recarga'; 
    } else {
        ganharBtn.classList.remove('bg-gray-400', 'cursor-not-allowed');
        ganharBtn.classList.add('bg-[#32CD32]', 'hover:bg-green-600');
        ganharBtn.disabled = false;
        ganharAmount.textContent = `+${userData.actions.earn}`;
        document.getElementById('earn-text').textContent = 'Ganhar'; 
    }
    
    renderTasks(document.getElementById('tasks-list'), false);
}


// --- LÓGICA DE AÇÕES ---

function toggleTaskCompletion(taskId) {
    const task = userData.tasks.find(t => t.id === taskId);
    if (task) {
        const wasCompleted = task.completed;
        task.completed = !task.completed;
        
        if (task.completed && !wasCompleted) {
            const reward = userData.actions.earn;
            userData.coins += reward; 
            addTransaction('earn', reward, `Tarefa concluída: ${task.text}`);
            checkBadges(); 
            showModal("Tarefa Concluída!", `Parabéns! Você ganhou **${reward} moedas**!`);
        } else if (wasCompleted && !task.completed) {
            const penalty = userData.actions.earn;
            userData.coins = Math.max(0, userData.coins - penalty);
            addTransaction('spend', penalty, `Tarefa desfeita: ${task.text}`);
            showModal("Tarefa Desfeita", `Você perdeu **${penalty} moedas** de volta.`);
        }
        saveChildData(currentUserId, userData);
    }
}

// NOVO: RENDERIZA MODAL PARA INPUT DE POUPANÇA
function renderSaveInputModal() {
    showModal("Quanto Quer Poupar? 💰", `
        <p class="font-itim mb-4">Seu saldo atual é de **${userData.coins} moedas**. Digite a quantidade que você quer guardar na meta:</p>
        <div class="space-y-4">
            <input type="number" id="save-input-amount" placeholder="Valor a Poupar" class="w-full p-3 border rounded-lg font-itim text-lg" min="1" max="${userData.coins}">
            <button id="execute-save-btn" class="w-full bg-blue-500 text-white p-3 rounded-lg font-itim text-xl hover:bg-blue-600 transition-colors">
                Guardar na Meta (${userData.progress.targetName})
            </button>
        </div>
    `);

    document.getElementById('execute-save-btn')?.addEventListener('click', () => {
        const amount = parseInt(document.getElementById('save-input-amount').value);
        executeSave(amount);
    });
}

// NOVO: EXECUTA A TRANSAÇÃO DE POUPANÇA
function executeSave(saveAmount) {
    if (isNaN(saveAmount) || saveAmount <= 0) {
        return showModal("Erro", "Por favor, insira um valor válido.");
    }
    if (userData.coins < saveAmount) {
        return showModal("Saldo Insuficiente", `Você precisa de **${saveAmount} moedas**, mas só tem ${userData.coins}.`);
    }

    userData.coins -= saveAmount;
    userData.progress.savedAmount += saveAmount;
    
    addTransaction('save', saveAmount, `Poupança para meta: ${userData.progress.targetName}`);
    awardBadge('first_save');
    checkBadges();
    saveChildData(currentUserId, userData);
    hideModal();
    showModal("Poupança Completa! 🏦", `Você guardou **${saveAmount} moedas** na sua meta!`);
}

// --- RENDERS DE MODAIS ESPECÍFICOS (A criança usa esses) ---

export function renderTasks(container, showDelete = false) {
     container.innerHTML = '';
    if (!userData.tasks || userData.tasks.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 pt-2 font-itim">Nenhuma tarefa. Adicione uma!</p>';
        return;
    }

    userData.tasks.forEach(task => {
        const li = document.createElement('li');
        const deleteBtn = showDelete ? `<button data-task-id="${task.id}" class="delete-task-btn text-red-500 p-1 hover:text-red-700 transition-colors"><i class="fa-solid fa-trash-can"></i></button>` : '';

        li.className = 'flex items-center justify-between p-3 border-b last:border-b-0';
        li.innerHTML = `
            <span class="text-lg font-itim ${task.completed ? 'line-through text-gray-500' : 'text-gray-800'}">
                ${task.text}
            </span>
            <div class="flex space-x-2 items-center">
                ${deleteBtn}
                ${!showDelete ? `
                <button data-task-id="${task.id}" class="toggle-task p-2 rounded-full w-10 h-10 flex items-center justify-center 
                    ${task.completed ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500 hover:bg-green-100'}">
                    <i class="fa-solid ${task.completed ? 'fa-check' : 'fa-circle'}"></i>
                </button>
                ` : ''}
            </div>
        `;
        container.appendChild(li);
    });

    if (!showDelete) { 
        document.querySelectorAll('.toggle-task').forEach(button => {
            button.addEventListener('click', (e) => {
                const taskId = e.currentTarget.dataset.taskId;
                toggleTaskCompletion(taskId);
            });
        });
    }
}

export function renderTaskManagementModal() {
     showModal("Tarefas Diárias", `
        <p class="font-bold font-itim text-lg mb-2">Marque as tarefas concluídas para ganhar moedas!</p>
        <div class="max-h-60 overflow-y-auto border rounded-lg">
             <ul id="modal-tasks-list" class="divide-y divide-gray-200">
                </ul>
        </div>
        <p class="text-sm text-gray-500 mt-4 font-itim text-center">As tarefas são definidas pelo seu responsável.</p>
     `);
     // Reusa a função de renderização, mas sem o botão de exclusão
     renderTasks(document.getElementById('modal-tasks-list'), false); 
}

export function renderGoalSettingModal() {
    showModal("Minha Meta de Poupança 🎯", `
        <p class="font-itim mb-4 text-center text-xl">
            Meta atual: <span class="text-blue-600 font-bold">${userData.progress.targetName}</span>
            (Faltam ${userData.progress.goal - userData.progress.savedAmount} moedas)
        </p>
        <div class="space-y-4">
            <label for="goal-name-input" class="font-bold font-itim block">Mudar o nome da meta:</label>
            <input type="text" id="goal-name-input" value="${userData.progress.targetName}" 
                   placeholder="Ex: Bicicleta Nova, Viagem, Tablet" 
                   class="w-full p-3 border rounded-lg font-itim text-lg">
            <button id="save-goal-name-btn" class="w-full bg-green-500 text-white p-3 rounded-lg font-itim text-xl hover:bg-green-600 transition-colors">
                Salvar Nome
            </button>
        </div>
        <p class="text-sm text-gray-500 mt-4 font-itim text-center">O valor da meta é definido pelo seu responsável.</p>
    `);

    document.getElementById('save-goal-name-btn')?.addEventListener('click', () => {
        const newName = document.getElementById('goal-name-input').value.trim();
        if (newName) {
            userData.progress.targetName = newName;
            saveChildData(currentUserId, userData);
            hideModal();
            showModal("Sucesso!", `O nome da meta foi atualizado para **${newName}**!`);
        } else {
            showModal("Erro", "O nome da meta não pode ser vazio.");
        }
    });
}

export function renderHistoryModal() { 
    const historyList = (userData.transactions && userData.transactions.length > 0) 
        ? `<ul class="space-y-2">${userData.transactions.map(t => `
            <li class="flex justify-between items-center p-2 rounded ${t.type === 'earn' ? 'bg-green-100 text-green-700' : t.type === 'donate' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}">
                <span class="font-itim text-xs w-1/4">${t.date}</span>
                <span class="font-itim text-xs w-1/2">${t.description}</span>
                <span class="font-bold text-sm w-1/4 text-right">${t.type === 'earn' ? '+' : '-'}${t.amount} Moedas</span>
            </li>
        `).join('')}</ul>`
        : '<p class="text-gray-500 font-itim text-center">Nenhuma transação recente.</p>';

    showModal("Histórico de Transações", `<div id="history-list" class="max-h-80 overflow-y-auto">${historyList}</div>`);
}

export function renderBadgesModal() {
    const ownedBadges = userData.badges || [];
    
    const badgeContent = Object.values(BADGES).map(badge => {
        const unlocked = ownedBadges.includes(badge.id);
        const iconClass = unlocked ? 'text-yellow-500' : 'text-gray-400';
        
        return `
            <div class="flex items-start space-x-3 p-3 border rounded-lg ${unlocked ? 'bg-yellow-50' : 'bg-gray-100'}">
                <i class="fa-solid ${badge.icon} text-3xl ${iconClass} mt-1"></i>
                <div>
                    <p class="font-bold text-lg">${badge.name}</p>
                    <p class="text-sm text-gray-700">${badge.description}</p>
                </div>
            </div>
        `;
    }).join('');

    showModal("Suas Conquistas 🏆", `
        <p class="font-itim mb-4 text-center text-xl">Você desbloqueou **${ownedBadges.length} de ${Object.keys(BADGES).length}** conquistas!</p>
        <div class="space-y-3 max-h-80 overflow-y-auto">
            ${badgeContent}
        </div>
    `);
}


// --- LÓGICA DA LOJA MÁGICA ---

function renderThemesShop() {
     return `<div class="grid grid-cols-2 gap-4">${Object.entries(DEFAULT_CHILD_DATA.settings.themes).map(([key, item]) => {
        const owned = userData.settings.themes[key]?.purchased;
        const price = item.price;
        const canAfford = userData.coins >= price;
        const buttonText = owned ? (userData.settings.theme === key ? 'Equipado' : 'Usar') : price === 0 ? 'Grátis' : canAfford ? 'Comprar' : 'Moedas';
        const buttonClass = userData.settings.theme === key ? 'bg-green-500' : owned ? 'bg-blue-500' : price === 0 ? 'bg-blue-500' : canAfford ? 'bg-orange-500' : 'bg-gray-400 cursor-not-allowed';
        
        return `
            <div class="p-3 border rounded-lg shadow-sm text-center bg-gray-50">
                <div class="h-16 w-full rounded-lg mb-2 shadow-inner" style="background: linear-gradient(180deg, ${item.start} 0%, ${item.end} 100%);"></div>
                <p class="font-bold">${key.charAt(0).toUpperCase() + key.slice(1)}</p>
                <p class="text-xs text-gray-500 mb-2">${owned ? 'Seu' : `${price} Moedas`}</p>
                <button class="shop-item-btn ${buttonClass} text-white text-sm p-2 rounded-lg w-full transition-colors"
                    data-type="theme" data-id="${key}" data-price="${price}" data-owned="${owned}">
                    ${buttonText}
                </button>
            </div>
        `;
    }).join('')}</div>`;
}

function renderPetsShop() {
    return `<div class="grid grid-cols-3 gap-3">${PET_CHARACTERS.map(item => {
        const owned = userData.unlockedPets.includes(item.id);
        const isEquipped = userData.currentPet?.id === item.id;
        const price = item.price;
        const canAfford = userData.coins >= price;
        const buttonText = isEquipped ? 'Equipado' : owned ? 'Usar' : price === 0 ? 'Grátis' : canAfford ? 'Comprar' : 'Moedas';
        const buttonClass = isEquipped ? 'bg-green-500' : owned ? 'bg-blue-500' : price === 0 ? 'bg-blue-500' : canAfford ? 'bg-orange-500' : 'bg-gray-400 cursor-not-allowed';
        
        return `
            <div class="p-2 border rounded-lg shadow-sm text-center bg-gray-50">
                <span class="text-4xl">${item.value}</span>
                <p class="font-bold text-sm">${item.label}</p>
                <p class="text-xs text-gray-500 mb-2">${owned ? 'Seu' : `${price} Moedas`}</p>
                <button class="shop-item-btn ${buttonClass} text-white text-xs p-1 rounded-lg w-full transition-colors"
                    data-type="pet" data-id="${item.id}" data-value="${item.value}" data-price="${price}" data-owned="${owned}">
                    ${buttonText}
                </button>
            </div>
        `;
    }).join('')}</div>`;
}

function renderIconsShop() {
    const currentIcon = userData.profileIcon.value;
    const shopItems = SHOP_ICONS.concat({ id: 'default', type: 'fa-icon', value: 'fa-user-astronaut', label: 'Padrão', price: 0 }); 
    
    return `<div class="grid grid-cols-3 gap-3">${shopItems.map(item => {
        const owned = userData.profileIcon.shopOwned.includes(item.id) || item.price === 0;
        const isEquipped = currentIcon === item.value;
        const price = item.price;
        const canAfford = userData.coins >= price;
        const buttonText = isEquipped ? 'Equipado' : owned ? 'Usar' : price === 0 ? 'Grátis' : canAfford ? 'Comprar' : 'Moedas';
        const buttonClass = isEquipped ? 'bg-green-500' : owned ? 'bg-blue-500' : price === 0 ? 'bg-blue-500' : canAfford ? 'bg-orange-500' : 'bg-gray-400 cursor-not-allowed';
        
        const iconDisplay = item.type === 'fa-icon' 
            ? `<i class="fa-solid ${item.value} text-3xl"></i>` 
            : `<span class="text-3xl">${item.value}</span>`;

        return `
            <div class="p-2 border rounded-lg shadow-sm text-center bg-gray-50">
                <div class="h-10 flex items-center justify-center">${iconDisplay}</div>
                <p class="font-bold text-sm">${item.label}</p>
                <p class="text-xs text-gray-500 mb-2">${owned ? 'Seu' : `${price} Moedas`}</p>
                <button class="shop-item-btn ${buttonClass} text-white text-xs p-1 rounded-lg w-full transition-colors"
                    data-type="icon" data-id="${item.id}" data-value="${item.value}" data-icon-type="${item.type}" data-price="${price}" data-owned="${owned}">
                    ${buttonText}
                </button>
            </div>
        `;
    }).join('')}</div>`;
}

function renderEmotionsShop() {
    const allEmotions = STANDARD_EMOTIONS.concat(SHOP_EMOTIONS);
    
    return `<div class="grid grid-cols-3 gap-3">${allEmotions.map(item => {
        const owned = userData.currentEmotion.shopOwned.includes(item.id) || item.price === 0 || !item.price;
        const isEquipped = userData.currentEmotion.value === item.value;
        const price = item.price || 0;
        const canAfford = userData.coins >= price;
        const buttonText = isEquipped ? 'Equipado' : owned ? 'Usar' : price === 0 ? 'Grátis' : canAfford ? 'Comprar' : 'Moedas';
        const buttonClass = isEquipped ? 'bg-green-500' : owned ? 'bg-blue-500' : price === 0 ? 'bg-blue-500' : canAfford ? 'bg-orange-500' : 'bg-gray-400 cursor-not-allowed';
        
        return `
            <div class="p-2 border rounded-lg shadow-sm text-center bg-gray-50">
                <span class="text-4xl">${item.value}</span>
                <p class="font-bold text-sm">${item.label}</p>
                <p class="text-xs text-gray-500 mb-2">${owned ? 'Seu' : `${price} Moedas`}</p>
                <button class="shop-item-btn ${buttonClass} text-white text-xs p-1 rounded-lg w-full transition-colors"
                    data-type="emotion" data-id="${item.id}" data-value="${item.value}" data-price="${price}" data-owned="${owned}">
                    ${buttonText}
                </button>
            </div>
        `;
    }).join('')}</div>`;
}

function attachShopEventListeners() {
    document.querySelectorAll('.shop-item-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const btn = e.currentTarget;
            const type = btn.dataset.type;
            const id = btn.dataset.id;
            const price = parseInt(btn.dataset.price);
            const owned = btn.dataset.owned === 'true';

            if (!owned) {
                if (userData.coins < price) {
                     return showModal("Moedas Insuficientes", `Você precisa de **${price} moedas** para comprar este item!`);
                }
                
                // Lógica de Compra
                userData.coins -= price;
                addTransaction('spend', price, `Compra na Loja: ${type} (${id})`);
                
                // Marca como comprado e equipa
                if (type === 'theme') {
                    userData.settings.themes[id].purchased = true;
                    userData.settings.theme = id;
                } else if (type === 'pet') {
                    userData.unlockedPets.push(id);
                    userData.currentPet = PET_CHARACTERS.find(p => p.id === id);
                } else if (type === 'icon') {
                    userData.profileIcon.shopOwned.push(id);
                    userData.profileIcon = { type: btn.dataset.iconType, value: btn.dataset.value, shopOwned: userData.profileIcon.shopOwned };
                } else if (type === 'emotion') {
                    userData.currentEmotion.shopOwned.push(id);
                    userData.currentEmotion = { value: btn.dataset.value, shopOwned: userData.currentEmotion.shopOwned };
                }

                showModal("Compra Concluída!", `Você comprou e equipou **${btn.textContent}** por **${price} moedas**!`);

            } else {
                // Lógica de Equipamento
                if (type === 'theme') {
                    userData.settings.theme = id;
                } else if (type === 'pet') {
                    userData.currentPet = PET_CHARACTERS.find(p => p.id === id);
                } else if (type === 'icon') {
                    userData.profileIcon = { type: btn.dataset.iconType, value: btn.dataset.value, shopOwned: userData.profileIcon.shopOwned };
                } else if (type === 'emotion') {
                    userData.currentEmotion = { value: btn.dataset.value, shopOwned: userData.currentEmotion.shopOwned };
                }
                showModal("Item Equipado", `Você está usando **${btn.textContent}**!`);
            }
            
            saveChildData(currentUserId, userData);
            renderShopModal(); // Re-renderiza a loja para atualizar os botões
        });
    });
}

export function renderShopModal() {
    showModal("Loja Mágica ✨", `
        <div class="tabs flex space-x-2 border-b mb-4 font-itim">
            <button id="tab-themes" class="tab-btn p-2 border-b-2 border-transparent hover:border-blue-400" data-tab="themes">Temas</button>
            <button id="tab-pets" class="tab-btn p-2 border-b-2 border-transparent hover:border-blue-400" data-tab="pets">Bichinhos</button>
            <button id="tab-icons" class="tab-btn p-2 border-b-2 border-transparent hover:border-blue-400" data-tab="icons">Ícones</button>
            <button id="tab-emotions" class="tab-btn p-2 border-b-2 border-transparent hover:border-blue-400" data-tab="emotions">Emoções</button>
        </div>
        <div id="shop-content"></div>
        <p class="text-right text-sm font-bold text-orange-500 mt-4">Suas Moedas: ${userData.coins}</p>
    `);
    
    function renderTab(tabId) {
        const contentEl = document.getElementById('shop-content');
        if (!contentEl) return;
        
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('border-blue-600', btn.dataset.tab === tabId);
            btn.classList.toggle('text-blue-600', btn.dataset.tab === tabId);
        });

        if (tabId === 'themes') contentEl.innerHTML = renderThemesShop();
        else if (tabId === 'pets') contentEl.innerHTML = renderPetsShop();
        else if (tabId === 'icons') contentEl.innerHTML = renderIconsShop();
        else if (tabId === 'emotions') contentEl.innerHTML = renderEmotionsShop();
        
        attachShopEventListeners();
    }
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => renderTab(e.target.dataset.tab));
    });
    
    renderTab('themes');
}

// --- ATTACH LISTENERS DA CRIANÇA ---

export function attachActionListeners() {
    if (piggyContainerEl) {
        piggyContainerEl.addEventListener('click', triggerReaction);
    }
    document.getElementById('action-ganhar')?.addEventListener('click', () => launchGame(userData));
    document.getElementById('action-poupar')?.addEventListener('click', renderSaveInputModal); 
    document.getElementById('action-gastar')?.addEventListener('click', renderShopModal);
    document.getElementById('action-doar')?.addEventListener('click', renderBadgesModal); 
    document.getElementById('tasks-edit-section')?.addEventListener('click', renderTaskManagementModal);
    document.getElementById('goal-section')?.addEventListener('click', renderGoalSettingModal);
    document.getElementById('emotion-display-container')?.addEventListener('click', renderEmotionsShop); // Agora usa a loja
}
