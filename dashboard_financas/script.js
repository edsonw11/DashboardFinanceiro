// ===============================================
// 1. VARIÁVEIS DE ESTADO E CONFIGURAÇÕES GLOBAIS
// As constantes globais DEVEM ser definidas primeiro para evitar ReferenceError
// ===============================================

// Constantes CRÍTICAS para o Gráfico
const MEDIA_GASTO_IDEAL = 3000; 

// Constantes de Configuração
const THRESHOLD_DIFF_PERCENT_ANNOTATION = 15; 
const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MONTH_NAMES_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// Variáveis de Escopo Global (Estado)
const today = new Date();
let currentMonth = today.getMonth() + 1; 
const CURRENT_YEAR = today.getFullYear(); 

let rawData = []; // Armazena dados de despesas de TODOS os meses
let rawRevenues = []; // Armazena dados de receitas de TODOS os meses
let sortedData = [];
let totalFilesProcessed = 0;
let filesSuccessfullyLoaded = 0;
let totalMonthlyExpenses = 0; 
let totalReceivedRevenue = 0;


// --- FIM VARIÁVEIS DE ESTADO ---

const EXPENSE_COLUMN_NAMES = {
    'categoria': 'Categoria',
    'vencimento': 'Vencimento (Dia do Mês)',
    'valor': 'Valor (R$)',
    'status': 'Status',
    'recorrencia': 'Recorrência',
    'tipo_gasto': 'Tipo de Gasto',
    'observacao': 'Observação',
    'cartao': 'Tipo Pagamento',
    'mes': 'Mês' 
};
const REVENUE_COLUMN_NAMES = {
    'fonte': 'Fonte',
    'valor': 'Valor (R$)',
    'status': 'Status',
    'recorrencia': 'Recorrência',
    'mes': 'Mês' 
};

// --- VARIÁVEIS DE ESTADO PARA INVESTIMENTO ---
let dadosInvestimentos = {}; 
const STORAGE_KEY_APORTE = 'minhaAppInvestimentosData';


// --- INICIALIZAÇÃO (MODIFICADA) ---
document.addEventListener('DOMContentLoaded', () => {


    
    // NOVO: Eventos para o Dropdown Salvar
    document.getElementById('save-current-month').addEventListener('click', (e) => {
        e.preventDefault();
        saveCurrentMonthData();
    });
    document.getElementById('save-all-months').addEventListener('click', (e) => {
        e.preventDefault();
        saveAllData(); 
    });
    
    const importButton = document.getElementById('import-csv-btn');
    const fileInput = document.getElementById('file-input');

    initializeDashboardData();
    
    if (importButton && fileInput) {
        importButton.addEventListener('click', () => fileInput.click()); 
        
        fileInput.addEventListener('change', (event) => {
            rawData = []; 
            rawRevenues = [];
            processSelectedFiles(event.target.files);
        });
    }
    
    document.getElementById('add-expense-form').addEventListener('submit', addExpense);
    document.getElementById('add-revenue-form').addEventListener('submit', addRevenue); 


    // 1. Encontra o elemento <details> que contém o gráfico de Evolução de Gastos
    const graficoEvolucaoDiv = document.getElementById('grafico-evolucao-mensal');
    if (graficoEvolucaoDiv) {
        // Encontra o ancestral mais próximo que é a tag <details>
        const evolutionAccordion = graficoEvolucaoDiv.closest('details');

        if (evolutionAccordion) {
            // 2. Adiciona um listener para o evento 'toggle' (abrir/fechar)
            evolutionAccordion.addEventListener('toggle', () => {
                // Verifica se o accordion foi aberto (evolutionAccordion.open é true)
                if (evolutionAccordion.open) {
                    // Aguarda um pequeno delay (50ms) para garantir que o navegador
                    // terminou de calcular as dimensões do container
                    setTimeout(() => {
                        // 3. Força o Plotly a recalcular e redesenhar o gráfico
                        // Usamos Plotly.relayout com autosize: true
                        if (typeof Plotly !== 'undefined') {
                            Plotly.relayout('grafico-evolucao-mensal', { 'autosize': true });
                        }
                    }, 50); 
                }
            });
        }
    }
    
    setupMonthSelector(); 
    setupEventDelegation(); 
    processData(); 
});

// --- FUNÇÕES DE UTILIDADE ---
function cleanCurrency(value) {
    if (typeof value === 'string' && value.trim() !== '') {
        let cleanValue = value.replace(/R\$/g, '').replace(/\$/g, '').replace(/\./g, '').replace(/,/g, '.').trim();
        return parseFloat(cleanValue) || 0; 
    }
    if (typeof value === 'number') return value;
    return 0;
}

// FUNÇÃO MODIFICADA PARA PERMITIR ABREVIAÇÃO K/M SE NECESSÁRIO (para caber nos boxes)
function formatCurrency(value) {
    value = value || 0;
    
    // Apenas formatação padrão: R$ 12.700,00
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatPercent(value) {
    if (typeof value === 'number' && !isNaN(value)) {
        return value.toFixed(1) + '%';
    }
    return '0.0%';
}
function capitalize(s) {
    if (typeof s !== 'string') return s;
    s = s.toLowerCase().trim();
    
    if (s === 'nao essencial') return 'Não Essencial';
    if (s === 'debito automatico' || s === 'debitoautomatico') return 'Débito Automático';
    if (s === 'unica') return 'Única'; // Tratamento para "unica"
    if (s === 'recebido') return 'Recebido';
    if (s === 'pendente') return 'Pendente';
    if (s === 'cartao') return 'Cartão';
    if (s === 'pix') return 'Pix';
    if (s === 'boleto') return 'Boleto';
    if (s === 'outros') return 'Outros';
    
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// --- FUNÇÃO PARA O SELETOR DE MÊS ---
function setupMonthSelector() {
    const selectorDiv = document.getElementById('month-selector');
    let html = '';
    for (let i = 1; i <= 12; i++) {
        const isActive = i === currentMonth ? 'active' : '';
        // Usa a versão curta do nome do mês para os botões
        html += `<button class="${isActive}" onclick="filterByMonth(${i})">${MONTH_NAMES_SHORT[i - 1]}</button>`;
    }
    selectorDiv.innerHTML = html;
}

function filterByMonth(month) {
    if (month < 1 || month > 12 || month === currentMonth) return;
    
    currentMonth = month;
    
    const buttons = document.querySelectorAll('.month-selector button');
    buttons.forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.month-selector button:nth-child(${month})`).classList.add('active');
    
    processData(); 
}

// --- FUNÇÕES DE IMPORTAÇÃO (Simplificadas) ---

function processSelectedFiles(files) {
     if (files.length === 0) return;
    
    totalFilesProcessed = files.length;
    filesSuccessfullyLoaded = 0;
    let fileCount = 0;
    let alertMessage = '';
    
    let nextIdExpense = rawData.length > 0 ? Math.max(...rawData.map(d => d.id)) + 1 : 0;
    let nextIdRevenue = rawRevenues.length > 0 ? Math.max(...rawRevenues.map(d => d.id)) + 1 : 0;

     Array.from(files).forEach(file => {
        parseFile(file, (success, type, fileName, normalizedData) => {
            fileCount++;
            
            if (success) {
                filesSuccessfullyLoaded++;
                alertMessage += `- Arquivo: "${fileName}" (Tipo: ${type}) - CARREGADO\n`;
                
                if (type === 'Despesa') {
                    normalizedData.forEach(d => { d.id = nextIdExpense++; });
                    rawData.push(...normalizedData);
                } else if (type === 'Receita') {
                    normalizedData.forEach(d => { d.id = nextIdRevenue++; });
                    rawRevenues.push(...normalizedData);
                }
                
            } else {
                 alertMessage += `- Arquivo: "${fileName}" - IGNORADO (Formato inválido ou cabeçalho incorreto)\n`;
            }


            if (fileCount === totalFilesProcessed) {
                setTimeout(() => {
                    if (rawData.length > 0 || rawRevenues.length > 0) {
                        // Renderiza o dashboard APENAS APÓS A CONFIRMAÇÃO DE DADOS
                        if (typeof processData === 'function') {
                            processData(); 
                        }
                        alert(`Importação concluída! ${filesSuccessfullyLoaded} de ${totalFilesProcessed} arquivo(s) processado(s) com sucesso.`);
                    } else {
                        alert(`Importação concluída. Nenhum dado válido foi encontrado para processamento.`);
                    }
                }, 100);
                processData();
            }
        });
    });
    document.getElementById('file-input').value = null;
}

function parseFile(file, callback) {
     Papa.parse(file, {
        header: true,
        dynamicTyping: false,
        skipEmptyLines: true,
        delimiter: ";", 
        complete: (results) => {
            const data = results.data;
            if (data.length === 0) { 
                callback(false, null, file.name); 
                return; 
            }
            
            const normalizeHeader = (h) => h.toLowerCase().trim().replace(/ /g, '').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const headerKeys = Object.keys(data[0]);
            
            const expenseExpectedKeys = Object.values(EXPENSE_COLUMN_NAMES).map(normalizeHeader);
            let isExpenseFile = expenseExpectedKeys.every(expected => headerKeys.some(h => normalizeHeader(h) === expected));
            
            const revenueExpectedKeys = Object.values(REVENUE_COLUMN_NAMES).map(normalizeHeader);
            // Deve conter o 'mes'
            let isRevenueFile = revenueExpectedKeys.every(expected => headerKeys.some(h => normalizeHeader(h) === expected));
            
            if (!isExpenseFile && !isRevenueFile) {
                 callback(false, null, file.name);
                 return;
            }
            
            const columnMap = isExpenseFile ? EXPENSE_COLUMN_NAMES : REVENUE_COLUMN_NAMES;
            const isExpense = isExpenseFile;

            const [normalizedData] = normalizeData(data, columnMap, isExpense);
            const type = isExpense ? 'Despesa' : 'Receita';
            
            callback(normalizedData.length > 0, type, file.name, normalizedData);
        },
        error: (error) => {
            console.error('Falha no carregamento de um arquivo.', file.name, error);
            callback(false, null, file.name);
        }
    });
}

function normalizeData(data, columnMap, isExpense) {
    let currentId = 0; // Vai ser sobrescrito ao adicionar ao rawData/rawRevenues
    
    const normalizedData = data.map((row) => {
        const newRow = { id: currentId++ }; 
        let hasValidValue = false;
        
        for (const internalKey in columnMap) {
            const expectedHeader = columnMap[internalKey];
            let value = row[expectedHeader];
            
            if (value === undefined) { 
                for (const header in row) { 
                    if (header.trim() === expectedHeader.trim()) { value = row[header]; break; } 
                    if (header.toLowerCase().replace(/ /g, '').normalize("NFD").replace(/[\u0300-\u036f]/g, "") === expectedHeader.toLowerCase().replace(/ /g, '').normalize("NFD").replace(/[\u0300-\u036f]/g, "")) { value = row[header]; break; }
                } 
            }
            
            if (internalKey === 'valor') {
                value = cleanCurrency(value);
                if (value > 0) hasValidValue = true;
            } else if (internalKey === 'vencimento') { 
                // NOVO: Adiciona a data completa como um campo temporário
                const vencimentoDia = parseInt(value) || 30;
                newRow['vencimento_full_date'] = new Date(CURRENT_YEAR, currentMonth - 1, vencimentoDia);
                value = vencimentoDia; // Mantém o dia do mês
            } else if (internalKey === 'mes' || internalKey === 'dia') { 
                value = parseInt(value, 10) || currentMonth; // Default para o mês atual
            } else {
                value = value ? String(value).trim() : '';
            }
            
            if (isExpense) {
                if (['status', 'recorrencia', 'tipo_gasto', 'cartao'].includes(internalKey)) {
                    value = value.toLowerCase().trim().replace(/ /g, '');
                    if (internalKey === 'tipo_gasto') {
                        value = value.includes('nao') || value.includes('não') ? 'nao essencial' : 'essencial';
                    }
                    // Mapeamento de Recorrência (INCLUINDO ÚNICA)
                    if (internalKey === 'recorrencia') {
                        let cleanRecurrence = value.toLowerCase().trim().replace(/ /g, '').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                        if (cleanRecurrence.includes('unica')) {
                            value = 'unica';
                        } else if (cleanRecurrence.includes('mensal')) {
                            value = 'mensal';
                        } else if (cleanRecurrence.includes('anual')) {
                            value = 'anual';
                        } else {
                            value = 'mensal'; // Default
                        }
                    }
                    // Mapeamento de Cartão
                    if (internalKey === 'cartao') {
                        let cleanPayment = value.toLowerCase().trim().replace(/ /g, '').normalize("NFD").replace(/[\u0300-\u036f]/g, "");

                        if (cleanPayment.includes('cartão') || cleanPayment.includes('cartao')) {
                            value = 'cartao';
                        } else if (cleanPayment.includes('débito') || cleanPayment.includes('debito')) {
                            value = 'debitoautomatico';
                        } else if (cleanPayment.includes('pix')) {
                            value = 'pix';
                        } else if (cleanPayment.includes('boleto')) {
                            value = 'boleto';
                        } else {
                            value = 'outros'; 
                        }
                    }
                }
            } else { // Receita
                if (['status', 'recorrencia'].includes(internalKey)) {
                    value = value.toLowerCase().trim().replace(/ /g, '');
                    if (internalKey === 'recorrencia') {
                        value = value.includes('unica') ? 'unica' : value;
                    }
                }
            }
            
            newRow[internalKey] = value;
        }
        
        if (isExpense) {
            newRow.status = newRow.status || 'pendente';
            newRow.recorrencia = newRow.recorrencia || 'mensal';
            newRow.tipo_gasto = newRow.tipo_gasto || 'essencial'; 
            newRow.cartao = newRow.cartao || 'outros';
            newRow.mes = newRow.mes || currentMonth; 
            newRow.ano = CURRENT_YEAR;
         
        } else { // Receita
            newRow.status = newRow.status || 'pendente';
            newRow.recorrencia = newRow.recorrencia || 'unica';
            newRow.mes = newRow.mes || currentMonth; 
            newRow.ano = CURRENT_YEAR;
      
        }
        
        return hasValidValue ? newRow : null;
    }).filter(row => row !== null);
    
    return [normalizedData, currentId];
}

// --- FUNÇÕES DE INTERAÇÃO E ATUALIZAÇÃO ---
function setupEventDelegation() {
    const container = document.querySelector('.container'); 
    const tableContainer = document.getElementById('tabela-gastos');

    container.addEventListener('change', function(event) {
        const target = event.target;
        
        if (target.classList.contains('tipo-gasto-select') || 
            target.classList.contains('cartao-select') || 
            target.classList.contains('recorrencia-select')) {
            
            const id = target.getAttribute('data-id');
            const field = target.getAttribute('data-field');
            const newValue = target.value;
            
            updateRowData(id, field, newValue);
        }
    });

    tableContainer.addEventListener('click', (event) => {
        const target = event.target;
        if (target.classList.contains('delete-btn')) {
            const row = target.closest('tr');
            if (row) {
                deleteExpense(parseInt(row.getAttribute('data-id')));
            }
        } else if (target.classList.contains('status-toggle-span')) { 
            const row = target.closest('tr');
            if (row) {
                togglePaymentStatus(parseInt(row.getAttribute('data-id')));
            }
        }
    });
    
    document.getElementById('receitas-list').addEventListener('click', (event) => {
        const target = event.target;
        if (target.classList.contains('delete-btn')) {
            // Busca o ID do elemento pai, pois o evento está na lista
            const listItem = target.closest('li');
            if (listItem) {
                deleteRevenue(parseInt(listItem.getAttribute('data-id')));
            }
        } else if (target.closest('li') && target.tagName === 'SPAN' && target.getAttribute('data-id')) {
            toggleRevenueStatus(parseInt(target.getAttribute('data-id')));
        }
    });
}

// --- CRUD Receita ---
function addRevenue(event) {
    event.preventDefault();
    const newRevenue = {
        id: rawRevenues.length > 0 ? Math.max(...rawRevenues.map(d => d.id)) + 1 : 0, 
        fonte: document.getElementById('new-rev-fonte').value,
        valor: parseFloat(document.getElementById('new-rev-valor').value) || 0,
        status: document.getElementById('new-rev-status').value.toLowerCase().trim(),
        recorrencia: document.getElementById('new-rev-recorrencia').value.toLowerCase().trim().replace('ú', 'u'),
        mes: currentMonth 
    };
    if (newRevenue.valor > 0) {
        rawRevenues.push(newRevenue);
        document.getElementById('add-revenue-form').reset();
        processData(); 
    } else { alert('O valor da receita deve ser maior que zero.'); }
}

function deleteRevenue(id) {
    rawRevenues = rawRevenues.filter(r => r.id !== id);
    processData(); 
}

function toggleRevenueStatus(id) {
    const item = rawRevenues.find(r => r.id === id);
    if (item) {
        item.status = item.status.toLowerCase().trim() === 'recebido' ? 'pendente' : 'recebido';
        processData(); 
    }
}

// NOVO: Função para renderizar receitas FILTRADAS PELO MÊS
function renderRevenues(revenues) {
    const listDiv = document.getElementById('receitas-list');
    let html = '<ul style="list-style: none; padding: 0;">';
    let currentTotalReceitas = 0; 
    
    if (revenues.length === 0) {
         listDiv.innerHTML = '<p style="text-align: center; color: #999; margin-top: 10px;">Nenhuma receita adicionada para este mês.</p>';
         document.getElementById('total-receitas').textContent = formatCurrency(0);
         totalReceivedRevenue = 0; 
         return;
    }

    revenues.forEach(r => { 
        const isReceived = r.status.toLowerCase().trim() === 'recebido';
        if (isReceived) {
            currentTotalReceitas += parseFloat(r.valor) || 0;
        }
        const statusColor = isReceived ? '#28a745' : '#ffc107';

        html += `
            <li data-id="${r.id}" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #eee; padding: 5px 0;">
                <span style="font-weight: bold; width: 40%;">${r.fonte}</span>
                <span style="width: 25%; text-align: right;">${formatCurrency(r.valor)}</span>
                <span data-id="${r.id}" onclick="toggleRevenueStatus(${r.id})" style="width: 20%; text-align: center; color: ${statusColor}; cursor: pointer; font-weight: bold;">${capitalize(r.status)}</span>
                <button class="delete-btn" style="width: 10%;">🗑️</button>
            </li>
        `;
    });

    html += '</ul>';
    listDiv.innerHTML = html;
    document.getElementById('total-receitas').textContent = formatCurrency(currentTotalReceitas);
    totalReceivedRevenue = currentTotalReceitas; 
}

// --- CRUD Despesa e Funções de Edição ---
function addExpense(event) {
    event.preventDefault();
    
    // Tratamento de Recorrência para string interna (unica, mensal, anual)
    const recorrencia = document.getElementById('new-recorrencia').value.toLowerCase().trim().replace('ú', 'u').replace(/ /g, '');
    const tipoPagamento = document.getElementById('new-cartao').value; 
    let tipo_gasto = document.getElementById('new-tipo').value.toLowerCase().trim();
    
    tipo_gasto = tipo_gasto.includes('nao') ? 'nao essencial' : 'essencial';

    const vencimentoDia = parseInt(document.getElementById('new-vencimento').value) || 30;
    
    const newExpense = {
        id: rawData.length > 0 ? Math.max(...rawData.map(d => d.id)) + 1 : 0, 
        categoria: document.getElementById('new-categoria').value,
        vencimento: vencimentoDia,
        valor: parseFloat(document.getElementById('new-valor').value) || 0,
        status: 'pendente', 
        recorrencia: recorrencia, 
        tipo_gasto: tipo_gasto, 
        observacao: 'Adicionado via dashboard',
        cartao: tipoPagamento.toLowerCase().trim().replace(/ /g, ''),
        mes: currentMonth 
    };

    if (newExpense.valor > 0) {
        rawData.push(newExpense);
        document.getElementById('add-expense-form').reset();
        processData();
    } else {
        alert('O valor da despesa deve ser maior que zero.');
    }
}

function deleteExpense(id) {
    if (confirm('Tem certeza que deseja excluir esta despesa permanentemente?')) {
        rawData = rawData.filter(d => d.id !== id);
        processData();
    }
}

function togglePaymentStatus(id) {
    const item = rawData.find(d => d.id === id);
    if (item) {
        const currentStatus = String(item.status || '').toLowerCase().trim();
        item.status = currentStatus === 'pago' ? 'pendente' : 'pago';
        
        processData();
    }
}

function updateRowData(id, field, newValue) {
    const itemId = parseInt(id); 
    const item = rawData.find(d => d.id === itemId);
    
    if (item) {
        let cleanedValue = String(newValue);

        if (field === 'tipo_gasto') {
             cleanedValue = cleanedValue.toLowerCase().trim().includes('nao') ? 'nao essencial' : 'essencial';
            item[field] = cleanedValue;
        } else if (field === 'valor' || field === 'vencimento') {
            item[field] = parseFloat(newValue) || 0;
        } else if (field === 'status' || field === 'recorrencia') {
            item[field] = cleanedValue.toLowerCase().trim().replace(/ /g, '').replace('ú', 'u'); // Limpeza da Recorrência
        } else if (field === 'cartao') {
            item[field] = cleanedValue.toLowerCase().trim().replace(/ /g, '');
        } else {
            item[field] = newValue;
        }
        
        processData(); 
    }
}

let currentSortColumn = 'vencimento';
let currentSortDirection = 1;

function sortTable(column) {
    if (currentSortColumn === column) {
        currentSortDirection *= -1; 
    } else {
        currentSortColumn = column;
        // NOVO: Valor padrão de ordenação: Decrescente para valor/percentual, Crescente para outros
        currentSortDirection = (column === 'percentual' || column === 'valor' || column === 'participacao_receita') ? -1 : 1; 
    }
    processData();
}

// --- PROCESSAMENTO CENTRAL (Com Filtro Mensal) ---
function processData() {
    
    // Filtra despesas pelo mês atual
    const filteredExpenses = rawData.filter(d => parseInt(d.mes) === currentMonth);
    
    // Filtra receitas pelo mês atual
    const filteredRevenues = rawRevenues.filter(r => parseInt(r.mes) === currentMonth); 
    
    // Calcula o total do mês (excluindo anuais) para o SUMÁRIO
    const monthlyData = filteredExpenses.filter(d => {
        const recurrence = String(d.recorrencia || '').toLowerCase().trim();
        // O total mensal deve incluir MENSAL e ÚNICA, mas NÃO ANUAL.
        return recurrence !== 'anual';
    });
    
    totalMonthlyExpenses = monthlyData.reduce((sum, d) => sum + d.valor, 0);
    
    // Renderiza receitas do mês selecionado e atualiza totalReceivedRevenue
    renderRevenues(filteredRevenues); 
    
    const totalReceitas = totalReceivedRevenue; 

    // Ordena os dados filtrados para a tabela
    sortedData = [...filteredExpenses] 
        .sort((a, b) => {
            // --- LÓGICA DE ORDENAÇÃO MULTI-CRITÉRIO: INICIAL OU POR CLIQUE NO HEADER ---
            let result = 0;
            const sortColumn = currentSortColumn;
            
            // 1. ORDENAÇÃO PADRÃO (SE NENHUM CLIQUE FOI FEITO) OU ORDENAÇÃO POR STATUS (SE CLICADO)
            if (sortColumn === 'vencimento' || currentSortColumn === 'status') {
                // Prioriza Status 'pendente' (0) antes de 'pago' (1)
                const statusA = String(a.status || '').toLowerCase().trim();
                const statusB = String(b.status || '').toLowerCase().trim();
                const sortStatusA = statusA === 'pendente' ? 0 : 1;
                const sortStatusB = statusB === 'pendente' ? 0 : 1;
                
                if (sortStatusA !== sortStatusB) {
                    return sortStatusA - sortStatusB; // Ordena por Status
                }
                
                // Se o Status é o mesmo (ambos pendentes), ordena por Vencimento
                if (sortStatusA === 0) { 
                     // NOVO: Criar data completa para a comparação cronológica
                     const dateA = new Date(CURRENT_YEAR, currentMonth - 1, a.vencimento);
                     const dateB = new Date(CURRENT_YEAR, currentMonth - 1, b.vencimento);
                     return dateA - dateB; // Ordem cronológica (do mais antigo/próximo ao mais novo)
                }
            }

            // 2. ORDENAÇÃO POR CLIQUE EM OUTRA COLUNA (Lógica Original)
            const calculatePercent = (value, total) => (total > 0) ? (value / total) : 0;
            
            if (sortColumn === 'percentual') {
                const aRecurrence = String(a.recorrencia).toLowerCase().trim();
                const bRecurrence = String(b.recorrencia).toLowerCase().trim();
                
                const aValue = aRecurrence !== 'anual' ? a.valor : 0;
                const bValue = bRecurrence !== 'anual' ? b.valor : 0;

                const aPercent = calculatePercent(aValue, totalMonthlyExpenses);
                const bPercent = calculatePercent(bValue, totalMonthlyExpenses);
                result = aPercent - bPercent;
                
            } else if (sortColumn === 'participacao_receita') {
                 const aPercent = calculatePercent(a.valor, totalReceitas);
                 const bPercent = calculatePercent(b.valor, totalReceitas);
                 result = aPercent - bPercent;
            }
            else {
                let aVal = a[sortColumn];
                let bVal = b[sortColumn];
                
                if (sortColumn === 'valor' || sortColumn === 'vencimento') {
                     result = aVal - bVal;
                } else {
                    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
                    if (typeof bVal === 'string') bVal = bVal.toLowerCase();

                    if (aVal < bVal) result = -1;
                    if (aVal > bVal) result = 1;
                }
            }
            
            return result * currentSortDirection; 
        });

    renderDashboard();
}

// FUNÇÃO renderDashboard MODIFICADA PARA OCULTAR BOXES ZERADOS
function renderDashboard() {
    // Nome do Mês Atual (Completo)
    const monthName = MONTH_NAMES[currentMonth - 1]; 

    // ATUALIZAÇÃO DOS TÍTULOS DOS GRÁFICOS
    document.getElementById('titulo-essencial').textContent = `Essencial vs. Não Essencial (${monthName})`;
    document.getElementById('titulo-pagamento').textContent = `Meio de Pagamento (${monthName})`;
    document.getElementById('titulo-evolucao-mensal').textContent = `📈 Evolução de Gastos Mensais (Ano Atual) - Mês Atual: ${monthName}`;
    
    // ATUALIZAÇÃO DOS TÍTULOS DOS PAINÉIS DE SUMÁRIO
    document.getElementById('titulo-total-receitas').textContent = `Total de Receitas (${monthName})`;
    document.getElementById('titulo-saldo-liquido').textContent = `Saldo Líquido (${monthName})`;
    document.getElementById('titulo-total-gastos').textContent = `Total de Gastos (${monthName})`;


    // monthlyData: despesas do mês atual, excluindo anuais (usado para painéis e gráficos do mês)
    const monthlyData = rawData.filter(d => {
        const recurrence = String(d.recorrencia || '').toLowerCase().trim();
        return parseInt(d.mes) === currentMonth && recurrence !== 'anual';
    });
    
    const totalMensal = totalMonthlyExpenses;
    const totalPago = monthlyData.filter(d => String(d.status || '').toLowerCase().trim() === 'pago').reduce((sum, d) => sum + d.valor, 0);
    
    // CÁLCULOS DO TIPO PAGAMENTO
    const totalCartao = monthlyData.filter(d => {
        const cartaoType = String(d.cartao || '').toLowerCase().trim();
        return cartaoType === 'cartao';
    }).reduce((sum, d) => sum + d.valor, 0);
    
    const totalDebito = monthlyData.filter(d => {
        const cartaoType = String(d.cartao || '').toLowerCase().trim();
        return cartaoType === 'debitoautomatico';
    }).reduce((sum, d) => sum + d.valor, 0);
    
    const totalPix = monthlyData.filter(d => {
        const cartaoType = String(d.cartao || '').toLowerCase().trim();
        return cartaoType === 'pix';
    }).reduce((sum, d) => sum + d.valor, 0);

    // Total Outros (Soma 'outros' E 'boleto')
    const totalOutros = monthlyData.filter(d => {
        const cartao = String(d.cartao || '').toLowerCase().trim();
        return cartao === 'outros' || cartao === 'boleto';
    }).reduce((sum, d) => sum + d.valor, 0);
    
    
    // Total de gastos do MÊS SELECIONADO (incluindo anuais, usado para cálculo de saldo)
    const totalGastosMesSelecionado = rawData.filter(d => parseInt(d.mes) === currentMonth).reduce((sum, d) => sum + d.valor, 0);

    const totalReceitas = totalReceivedRevenue; // Receitas recebidas do MÊS SELECIONADO
    const saldoLiquido = totalReceitas - totalGastosMesSelecionado; // Saldo do MÊS SELECIONADO
    
    
    // --- NOVO CÓDIGO AQUI: RENDERIZAÇÃO E REGRA DE VISIBILIDADE PARA BOXES ---
    const totals = {
        'total-mensal': totalMensal,
        'total-pago': totalPago,
        'total-cartao': totalCartao,
        'total-debito': totalDebito,
        'total-pix': totalPix,
        'total-outros': totalOutros,
    };
    
    for (const [id, value] of Object.entries(totals)) {
        const element = document.getElementById(id);
        const box = element ? element.closest('.summary-box') : null;
        
        // Renderiza o valor formatado
        element.textContent = formatCurrency(value);
        
        // REGRA PRINCIPAL: Se o valor for zero, oculta o box
        if (box) {
            if (value === 0) {
                box.style.display = 'none'; // Oculta o box
            } else {
                box.style.display = 'block'; // Garante que o box seja exibido se tiver valor
            }
        }
    }
    // --- FIM DA LÓGICA DE VISIBILIDADE ---


    // ATUALIZAÇÃO DOS CAMPOS NÃO-BOXES
    document.getElementById('total-todos-meses').textContent = formatCurrency(totalGastosMesSelecionado); 
    
    // ATUALIZAÇÃO DO SALDO LÍQUIDO
    document.getElementById('saldo-liquido').textContent = formatCurrency(saldoLiquido);
    document.getElementById('saldo-liquido').style.color = saldoLiquido >= 0 ? '#28a745' : '#dc3545';

    renderMonthlyEvolutionChart(); 
    renderEssencialChart(monthlyData);
    renderPaymentMethodChart(monthlyData); 
    renderCategoryProportionChart(monthlyData);
  
    renderTable(sortedData, totalReceitas); 
}

// --- FUNÇÕES DE GRÁFICOS (mantidas) ---


function renderMonthlyEvolutionChart() {
    
    const graficoDiv = document.getElementById('grafico-evolucao-mensal');

    if (!graficoDiv || typeof Plotly === 'undefined') {
        console.error("Elemento do gráfico ou Plotly não encontrado.");
        return;
    }

    
        const dataGastos = getMonthlyExpenseComparisonData();
        
        const { meses: keys, gastos: monthlyTotalTotals, gastosPagos: monthlyPaidTotals } = dataGastos;
        
        if (monthlyTotalTotals.length === 0 || monthlyTotalTotals.every(total => total === 0)) {
            graficoDiv.innerHTML = '<p style="text-align: center; color: #6c757d;">Dados de gastos insuficientes para gerar a evolução mensal.</p>';
            return;
        }

        // Mapeia chaves para rótulos curtos (Jan 24, Fev 25, etc.)
        const labels = keys.map(key => {
            const [ano, mes] = key.split('-').map(Number);
            return `${MONTH_NAMES_SHORT[mes - 1]} ${String(ano).slice(2)}`;
        });

        

        // Cálculos e dados customizados (Receita, Saldo, Média)
        const monthlyRevenueTotals = calculateMonthlyRevenueTotals(rawRevenues || [], keys);
        const netIncome = monthlyRevenueTotals.map((revenue, index) => revenue - (monthlyTotalTotals[index] || 0));
        const totalGasto = monthlyTotalTotals.reduce((sum, val) => sum + val, 0);
        const mediaGasto = totalGasto / monthlyTotalTotals.length;
        const pendingItemsCustomData = dataGastos.pendingLists.map(list => [list]);
        const netIncomeCustomData = netIncome.map(value => [formatCurrency(value)]);


       

        // 5. LAYOUT E SHAPES
        const layout = {
            annotations: [], 
            legend: { orientation: 'h', xanchor: 'center', x: 0.5, yanchor: 'top', y: -0.25 },
            shapes: [
                // Linha da Meta 
                { type: 'line', xref: 'paper', yref: 'y', x0: 0, y0: MEDIA_GASTO_IDEAL, x1: 1, y1: MEDIA_GASTO_IDEAL, line: { color: 'orange', width: 2, dash: 'dashdot' } },
                // Linha da Média Real 
                { type: 'line', xref: 'paper', yref: 'y', x0: 0, y0: mediaGasto, x1: 1, y1: mediaGasto, line: { color: '#6f42c1', width: 1, dash: 'dash' } }
            ],
            xaxis: { tickmode: 'array', tickvals: labels, ticktext: labels },
            yaxis: { title: 'Valor (R$)', rangemode: 'tozero' },
            margin: { t: 40, l: 40, r: 20, b: 150 }, 
            
            // MODO INICIAL: closest (mostra apenas a linha mais próxima)
            hovermode: 'Closest' 
        };

        // 6. TRACES (AS LINHAS DO GRÁFICO)
        
        const traceTotal = { 
            x: labels, y: monthlyTotalTotals, mode: 'lines+markers', type: 'scatter', name: 'Gasto Projetado', 
            line: { color: '#dc3545', width: 3 }, 
            marker: { size: 8, color: '#dc3545', line: { width: 1, color: 'white' } }, 
            hoverinfo: 'text', text: dataGastos.tooltips, 
            hovertemplate: '<b>Mês/Ano:</b> %{x}<br><b>Gasto Projetado:</b> %{y:$.2f}<br><br>%{text}<extra></extra>' 
        };
        
        const tracePaid = { 
            x: labels, y: monthlyPaidTotals, mode: 'lines+markers', type: 'scatter', name: 'Gasto Pago', 
            line: { color: '#28a745', width: 2, dash: 'dot' }, 
            marker: { size: 8, color: '#28a745', line: { width: 1, color: 'white' } }, 
            customdata: pendingItemsCustomData, 
            hovertemplate: '<b>Gasto Pago:</b> R$ %{y:,.2f}<br><br>%{customdata[0]}<extra></extra>' 
        };

        const traceRevenue = { 
            x: labels, y: monthlyRevenueTotals, mode: 'lines+markers', type: 'scatter', name: 'Receita Recebida', 
            line: { color: '#007bff', width: 2, dash: 'dash' }, 
            customdata: netIncomeCustomData, 
            hovertemplate: '<b>Receita:</b> R$ %{y:,.2f}<br><b>Saldo Líquido:</b> R$ %{customdata[0]:,.2f}<extra>Receita Total</extra>' 
        };

        const traceGoal = { 
            x: [labels[0]], 
            y: [MEDIA_GASTO_IDEAL], 
            mode: 'lines', 
            type: 'scatter', 
            name: `Meta Ideal (R$ ${formatCurrency(MEDIA_GASTO_IDEAL)})`, 
            line: { color: 'orange', width: 1, dash: 'dashdot' }, 
            marker: { size: 0 }, 
            showlegend: true, 
            hoverinfo: 'none' 
        };

        
        // 7. Renderiza o gráfico e, em seguida, anexa os listeners de hover (A Promessa .then)
        Plotly.react(graficoDiv, [traceTotal, tracePaid, traceRevenue, traceGoal], layout, { displayModeBar: false, responsive: true });

   

}



function renderCategoryProportionChart(data) {
     const groupedData = data.reduce((acc, row) => {
        const category = row.categoria.trim() || 'Sem Categoria';
        acc[category] = (acc[category] || 0) + row.valor;
        return acc;
    }, {});

    const totalGeral = data.reduce((sum, row) => sum + row.valor, 0);

    const sortedCategories = Object.entries(groupedData).sort(([, a], [, b]) => a - b); 

    const categories = sortedCategories.map(item => item[0]);
    const values = sortedCategories.map(item => item[1]);
    
    const percentages = values.map(value => (value / totalGeral) * 100);
    const textLabels = percentages.map(p => `${p.toFixed(1)}%`);


    const chartData = [{
        x: values,
        y: categories,
        type: 'bar',
        orientation: 'h', 
        text: textLabels, 
        textposition: 'outside', 
        marker: { color: Plotly.d3.scale.category20().range() },
        hovertemplate: '<b>%{y}</b><br>Valor: R$ %{x:,.2f}<br>Participação: **%{text}**<extra></extra>'
    }];

    const layout = {
        title: 'Gasto Total por Categoria (Ranking - Mês Selecionado)',
        height: 600, 
        xaxis: { title: 'Valor Total Gasto (R$)', tickformat: '$,.0f' },
        yaxis: { automargin: true, tickfont: { size: 12 } },
        margin: { t: 50, b: 50, l: 150, r: 20 },
        uniformtext: { mode: 'hide', minsize: 9 },
        xaxis: { automargin: true }
    };

    Plotly.react('grafico-categoria', chartData, layout, {displayModeBar: false});
}

function renderEssencialChart(data) {
     const groupedData = data.reduce((acc, row) => {
        const cleanedType = String(row.tipo_gasto || '').toLowerCase().trim();
        const type = cleanedType.includes('nao') ? 'Não Essencial' : 'Essencial';
                     
        acc[type] = acc[type] || { total: 0, details: [] };
        acc[type].total += row.valor;
        acc[type].details.push({ categoria: row.categoria, valor: row.valor });
        return acc;
    }, {});

    const labels = Object.keys(groupedData);
    const values = labels.map(label => groupedData[label].total);
    
    const customData = labels.map(label => {
        const details = groupedData[label].details;
        details.sort((a, b) => b.valor - a.valor);
        let detailString = details.map(d => `- ${d.categoria}: ${formatCurrency(d.valor)}`).join('<br>'); 
        return detailString || 'Nenhuma despesa detalhada.';
    });
    
    const chartData = [{
        values: values,
        labels: labels,
        type: 'pie',
        hole: .4, 
        marker: { colors: ['#28a745', '#dc3545'] },
        customdata: customData, 
        hovertemplate: '<b>%{label}</b><br>R$ %{value:,.2f}<br>Total: %{percent}<br>%{customdata}<extra></extra>', 
        textinfo: 'percent',
        textposition: 'inside',
    }];

    const layout = {
        title: false, 
        height: 400,
        margin: { t: 50, b: 0, l: 0, r: 0 }
    };

    Plotly.react('grafico-essencial', chartData, layout, {displayModeBar: false});
}

function renderPaymentMethodChart(data) {
     const groupedData = data.reduce((acc, row) => {
        const label = String(row.cartao || 'outros').toLowerCase().trim();
        const displayLabel = capitalize(label);
                    
        acc[displayLabel] = acc[displayLabel] || { total: 0, details: [] };
        acc[displayLabel].total += row.valor;
        
        acc[displayLabel].details.push({ 
            categoria: row.categoria, 
            valor: row.valor 
        });
        return acc;
    }, {});

    const paymentMap = [
        { label: 'Cartão', internalKey: 'cartao', color: '#007bff' },             
        { label: 'Pix', internalKey: 'pix', color: '#6f42c1' },                
        { label: 'Débito Automático', internalKey: 'debitoautomatico', color: '#ffc107' },  
        { label: 'Outros', internalKey: 'outros', color: '#dc3545' },             
    ];

    let labels = [];
    let values = [];
    let customColors = [];
    let customData = [];
    
    let totalOutrosAggregated = 0;
    let detailsOutrosAggregated = [];
    
    // Agrega Boleto e Outros no item "Outros" para fins de exibição no gráfico
    if (groupedData['Boleto']) {
        totalOutrosAggregated += groupedData['Boleto'].total;
        detailsOutrosAggregated.push(...groupedData['Boleto'].details);
        delete groupedData['Boleto'];
    }
    if (groupedData['Outros']) {
        totalOutrosAggregated += groupedData['Outros'].total;
        detailsOutrosAggregated.push(...groupedData['Outros'].details);
        delete groupedData['Outros'];
    }
    
    if (totalOutrosAggregated > 0) {
         groupedData['Outros'] = { total: totalOutrosAggregated, details: detailsOutrosAggregated };
    }

    Object.keys(groupedData).forEach(displayLabel => {
        const data = groupedData[displayLabel];

        labels.push(displayLabel);
        values.push(data.total);
        
        let color = '#333';
        const mapItem = paymentMap.find(m => m.label === displayLabel);
        if (mapItem) {
             color = mapItem.color;
        } else if (displayLabel === 'Outros') {
             color = paymentMap.find(m => m.label === 'Outros').color;
        }
        customColors.push(color);
        
        const details = data.details;
        details.sort((a, b) => b.valor - a.valor);
        let detailString = details.map(d => `- ${d.categoria}: ${formatCurrency(d.valor)}`).join('<br>'); 
        customData.push(detailString || 'Nenhuma despesa detalhada.');
    });


    const chartData = [{
        values: values,
        labels: labels,
        type: 'pie',
        hole: .4, 
        marker: { colors: customColors }, 
        customdata: customData, 
        hovertemplate: '<b>%{label}</b><br>R$ %{value:,.2f}<br>Total: %{percent}<br>%{customdata}<extra></extra>', 
        textinfo: 'percent',
        textposition: 'inside',
    }];

    const layout = {
        title: false,
        height: 400,
        margin: { t: 50, b: 0, l: 0, r: 0 }
    };

    Plotly.react('grafico-pagamento', chartData, layout, {displayModeBar: false});
}

// --- FUNÇÃO DE RENDERIZAÇÃO DA TABELA (MODIFICADA: Alerta de Vencimento) ---
function renderTable(data, totalReceitas) {


    

    
    const tableDiv = document.getElementById('tabela-gastos');
    let html = '<table><thead><tr>';
    
    const displayHeaders = [
        { key: 'row_number', label: '#', sortable: false }, 
        { key: 'categoria', label: 'Categoria', sortable: true },
        { key: 'valor', label: 'Valor (R$)', sortable: true },
        { key: 'percentual', label: 'Partic. Gasto (%)', sortable: true }, 
        { key: 'participacao_receita', label: 'Partic. Receita (%)', sortable: true }, 
        { key: 'vencimento', label: 'Vencimento', sortable: true },
        { key: 'recorrencia', label: 'Recorrência', sortable: true },
        { key: 'tipo_gasto', label: 'Tipo', sortable: true },
        { key: 'cartao', label: 'Tipo Pagamento', sortable: true }, 
        { key: 'status', label: 'Status', sortable: true },
        { key: 'observacao', label: 'Observação', sortable: false },
        { key: 'actions', label: 'Ações', sortable: false }
    ];
    

    displayHeaders.forEach(h => {
        const direction = currentSortColumn === h.key ? (currentSortDirection === 1 ? ' ▲' : ' ▼') : '';
        html += `<th ${h.sortable ? `onclick="sortTable('${h.key}')"` : ''}>${h.label}${direction}</th>`;
    });
    html += '</tr></thead><tbody>';

    let totalValor = 0; 

    // --- VARIÁVEIS PARA ALERTA DE VENCIMENTO ---
    const today = new Date();
    // Zera horas, minutos, segundos para garantir comparação correta do dia
    today.setHours(0, 0, 0, 0); 
    const limiteDiasAlerta = 7; // Alerta para vencimentos em 7 dias ou menos

    data.forEach((row, index) => {
        const statusValue = String(row.status || '').toLowerCase().trim();
        const statusClass = statusValue === 'pago' ? 'status-pago' : 'status-pendente';
        
        
        let rowAlertClass = '';
        
        // 1. Lógica da Sinalização (apenas se for PENDENTE)
        if (statusValue === 'pendente') {
            
            const vencimentoDia = parseInt(row.vencimento);
            
            if (vencimentoDia >= 1 && vencimentoDia <= 31) {
                // Cria a data de vencimento no Mês/Ano atual (o mês é currentMonth - 1)
                const vencimentoDate = new Date(CURRENT_YEAR, currentMonth - 1, vencimentoDia); 
               // CORREÇÃO: Define o horário para 12:00
               vencimentoDate.setHours(12, 0, 0, 0);
                
                const diffTime = vencimentoDate.getTime() - today.getTime();
                const diasParaVencimento = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (diasParaVencimento < 0) {
                    // Item Vencido (Vencimento já passou, mas status é 'pendente')
                    rowAlertClass = 'vencido'; 
                } else if (diasParaVencimento <= limiteDiasAlerta) {
                    // Item Próximo do Vencimento
                    rowAlertClass = 'alerta-vencimento';
                }
            }
        }

        // Aplica as classes
        html += `<tr class="${statusClass} ${rowAlertClass}" data-id="${row.id}">`;
        
        
        displayHeaders.forEach(header => {
            let cellContent = '';
            const rowValue = row[header.key];
            const value = (rowValue !== null && rowValue !== undefined) ? String(rowValue).toLowerCase().trim() : '';

            if (header.key === 'row_number') {
                cellContent = index + 1; 
            } else if (header.key === 'valor') {
                cellContent = `<span class="editable-cell" onclick="makeEditable(${row.id}, '${header.key}', 'number', 2)">${formatCurrency(rowValue)}</span>`;
                
                // Soma apenas despesas mensais e unicas para o rodapé (exclui anuais)
                if(String(row.recorrencia).toLowerCase().trim() !== 'anual') {
                    totalValor += rowValue; 
                }
                
            } else if (header.key === 'percentual') {
                let percentage = 0;
                 // Calcula % em relação ao total mensal (exclui anuais)
                 if (totalMonthlyExpenses > 0 && String(row.recorrencia).toLowerCase().trim() !== 'anual') {
                    percentage = (row.valor / totalMonthlyExpenses) * 100;
                }
                cellContent = `<span class="percent-cell">${formatPercent(percentage)}</span>`;
            }
            else if (header.key === 'participacao_receita') { 
                let percentage = 0;
                 if (totalReceitas > 0) {
                    percentage = (row.valor / totalReceitas) * 100;
                }
                cellContent = `<span class="percent-cell" style="color:#007bff">${formatPercent(percentage)}</span>`;
            }
            else if (header.key === 'vencimento') {
                cellContent = `<span class="editable-cell" onclick="makeEditable(${row.id}, '${header.key}', 'number', 0)">${rowValue}</span>`;
            } else if (header.key === 'categoria' || header.key === 'observacao') {
                cellContent = `<span class="editable-cell" onclick="makeEditable(${row.id}, '${header.key}', 'text')">${rowValue}</span>`;
            } 
            else if (header.key === 'cartao') {
                const paymentOptions = [
                    'Cartão', 'Pix', 'Débito Automático', 'Boleto', 'Outros'
                ];
                
                let selectOptions = paymentOptions.map(opt => {
                    let selectValue = opt.toLowerCase().replace(/ /g, '').replace('á', 'a').replace('é', 'e');
                    
                    if (opt === 'Cartão') selectValue = 'cartao';
                    if (opt === 'Débito Automático') selectValue = 'debitoautomatico';
                    if (opt === 'Pix') selectValue = 'pix';
                    if (opt === 'Boleto') selectValue = 'boleto';
                    if (opt === 'Outros') selectValue = 'outros';
                    
                    const isSelected = value.includes(selectValue) ? 'selected' : '';

                    return `<option value="${selectValue}" ${isSelected}>${opt}</option>`;
                }).join('');

                cellContent = `
                    <select class="cartao-select" data-id="${row.id}" data-field="${header.key}">
                        ${selectOptions}
                    </select>
                `;
            } 
            else if (header.key === 'recorrencia') {
                // NOVO: Adiciona 'Única' na lista de opções
                cellContent = `<select class="recorrencia-select" data-id="${row.id}" data-field="${header.key}">
                    <option value="mensal" ${value === 'mensal' ? 'selected' : ''}>Mensal</option>
                    <option value="anual" ${value === 'anual' ? 'selected' : ''}>Anual</option>
                    <option value="unica" ${value === 'unica' ? 'selected' : ''}>Única</option>
                </select>`;
            } else if (header.key === 'status') {
                cellContent = `<span class="status-toggle-span" data-id="${row.id}">${capitalize(row.status)}</span>`;
            } else if (header.key === 'tipo_gasto') {
                cellContent = `<select class="tipo-gasto-select" data-id="${row.id}" data-field="${header.key}"><option value="Essencial" ${value === 'essencial' ? 'selected' : ''}>Essencial</option><option value="Nao Essencial" ${value === 'nao essencial' ? 'selected' : ''}>Não Essencial</option></select>`;
            } else if (header.key === 'actions') {
                cellContent = `<button class="delete-btn" onclick="deleteExpense(${row.id})">🗑️</button>`;
            } else {
                cellContent = rowValue; 
            }
            
            html += `<td>${cellContent}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody>';
    
    const numeroDeItens = data.length;
    const colSpanBeforeTotal = displayHeaders.findIndex(h => h.key === 'valor'); 
    
    html += `<tfoot>
                <tr>
                    <th colspan="${colSpanBeforeTotal}">
                        Total Geral Deste Mês (${numeroDeItens} itens - Excluindo Anuais):
                    </th>
                    <th style="text-align: right;">${formatCurrency(totalValor)}</th>
                    <th colspan="${displayHeaders.length - colSpanBeforeTotal - 1}"></th> 
                </tr>
            </tfoot>`;
    
    html += '</table>';
    tableDiv.innerHTML = html;
}

// --- Funções de Edição (mantidas) ---
function makeEditable(id, field, type, decimals = 0) {
    const rowElement = document.querySelector(`tr[data-id="${id}"]`);
    if (!rowElement) return;

    const cellSpan = rowElement.querySelector(`span[onclick*="makeEditable(${id}, '${field}'"]`);
    if (!cellSpan || cellSpan.querySelector('input')) return; 

    const originalValue = field === 'valor' ? cleanCurrency(cellSpan.textContent) : cellSpan.textContent;
    
    const input = document.createElement('input');
    input.type = type;
    input.value = originalValue;
    input.className = 'editable-input';
    
    if (type === 'number') {
        input.step = decimals > 0 ? '0.01' : '1';
    }

    input.onblur = () => {
        let newValue = input.value;
        if (type === 'number') {
            newValue = parseFloat(newValue) || 0;
            if (field === 'vencimento' && (newValue < 1 || newValue > 31)) {
                alert('O dia de vencimento deve estar entre 1 e 31.');
                updateRowDisplay(id, field, originalValue);
                return;
            }
        }
        
        updateRowData(id, field, newValue);
        if(field !== 'valor' && field !== 'vencimento') {
            updateRowDisplay(id, field, newValue);
        }
    };
    
    cellSpan.onclick = null; 

    cellSpan.innerHTML = '';
    cellSpan.appendChild(input);
    input.focus();
}

function updateRowDisplay(id, field, value) {
    const rowElement = document.querySelector(`tr[data-id="${id}"]`);
    if (!rowElement) return;

    const cellSpan = rowElement.querySelector(`span[onclick*="makeEditable(${id}, '${field}'"]`);
    if (cellSpan) {
        cellSpan.textContent = field === 'valor' ? formatCurrency(value) : value;
        cellSpan.onclick = () => makeEditable(id, field, (field === 'valor' || field === 'vencimento') ? 'number' : 'text', field === 'valor' ? 2 : 0);
    }
}

// --- FUNÇÕES DE EXPORTAÇÃO (mantidas) ---

// NOVO: Função para salvar APENAS o mês atual (Despesas e Receitas)
function saveCurrentMonthData() {
    let exportedCount = 0;
    const monthName = MONTH_NAMES[currentMonth - 1]; 

    // 1. Exporta Despesas do Mês Atual
    if (rawData.some(d => parseInt(d.mes) === currentMonth)) {
        exportExpensesToCSV(currentMonth);
        exportedCount++;
    }
    // 2. Exporta Receitas do Mês Atual
    if (rawRevenues.some(r => parseInt(r.mes) === currentMonth)) {
        exportRevenuesToCSV(currentMonth);
        exportedCount++;
    }
    
    alert(`Processo de exportação iniciado. ${exportedCount} arquivo(s) CSV (Despesas e Receitas) do mês de ${monthName} serão enviados para download.`);
}

// Função original (agora salva todos os 24 arquivos)
function saveAllData() { 
    let exportedCount = 0;
    
    for (let i = 1; i <= 12; i++) {
        // 1. Exporta Despesas Mensais
        if (rawData.some(d => parseInt(d.mes) === i)) {
            exportExpensesToCSV(i);
            exportedCount++;
        }
        // 2. Exporta Receitas Mensais
        if (rawRevenues.some(r => parseInt(r.mes) === i)) {
            exportRevenuesToCSV(i);
            exportedCount++;
        }
    }
    
    alert(`Processo de exportação iniciado. ${exportedCount} arquivos CSV (Despesas e Receitas por Mês) serão enviados para download. Você deve aceitar os múltiplos downloads.`);
}

function exportExpensesToCSV(month) {
    const EXPORT_EXPENSE_COLUMN_NAMES = {
        'categoria': 'Categoria',
        'vencimento': 'Vencimento (Dia do Mês)',
        'valor': 'Valor (R$)',
        'status': 'Status',
        'recorrencia': 'Recorrência',
        'tipo_gasto': 'Tipo de Gasto',
        'observacao': 'Observação',
        'cartao': 'Tipo Pagamento',
        'mes': 'Mês'
    };
    
    const dataFilteredByMonth = rawData.filter(item => parseInt(item.mes) === month);

    const dataToExport = dataFilteredByMonth.map(item => {
        const row = {};
        for (const internalKey in EXPORT_EXPENSE_COLUMN_NAMES) {
            const originalHeader = EXPORT_EXPENSE_COLUMN_NAMES[internalKey];
            let value = item[internalKey];

            if (internalKey === 'valor') {
                value = String(value).replace('.', ','); 
            } else if (['status', 'tipo_gasto', 'cartao'].includes(internalKey)) {
                value = capitalize(value);
            } else if (internalKey === 'recorrencia') {
                // Tratamento específico para recorrência
                value = capitalize(value);
                if (value === 'Unica') value = 'Única'; // Mantém o acento na exportação
            } else if (typeof value === 'string') {
                value = value.includes(';') ? `"${value}"` : value;
            }

            row[originalHeader] = value;
        }
        return row;
    });

    const csv = Papa.unparse(dataToExport, { header: true, delimiter: ";", quotes: false });
    const monthStr = String(month).padStart(2, '0');
    const filename = `${monthStr}-controle-gastos_${CURRENT_YEAR}.csv`;
    
    downloadCSV(csv, filename);
}

function exportRevenuesToCSV(month) {
    const REVENUE_EXPORT_COLUMN_NAMES = {
        'fonte': 'Fonte',
        'valor': 'Valor (R$)',
        'status': 'Status',
        'recorrencia': 'Recorrência',
        'mes': 'Mês'
    };
    
    const dataFilteredByMonth = rawRevenues.filter(item => parseInt(item.mes) === month);
    
    const dataToExport = dataFilteredByMonth.map(item => {
        const row = {};
        for (const internalKey in REVENUE_EXPORT_COLUMN_NAMES) {
            const originalHeader = REVENUE_EXPORT_COLUMN_NAMES[internalKey];
            let value = item[internalKey];

            if (internalKey === 'valor') {
                value = String(value).replace('.', ',');
            } else if (['status'].includes(internalKey)) {
                value = capitalize(value);
            } else if (internalKey === 'recorrencia') {
                value = capitalize(value);
                if (value === 'Unica') value = 'Única';
            } else if (typeof value === 'string') {
                value = value.includes(';') ? `"${value}"` : value;
            }

            row[originalHeader] = value;
        }
        return row;
    });

    const csv = Papa.unparse(dataToExport, { header: true, delimiter: ";", quotes: false });
    const monthStr = String(month).padStart(2, '0');
    const filename = `${monthStr}-controle-receitas_${CURRENT_YEAR}.csv`;
    downloadCSV(csv, filename);
}

function downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    
    link.download = filename;
    link.href = URL.createObjectURL(blob);
    
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}



// ===================================
// NOVO: LÓGICA DE COMPARAÇÃO MENSAL E TOOLTIP
// ===================================

/**
 * Processa rawData para obter totais mensais, variação percentual 
 * e os detalhes das categorias que mais contribuíram para a diferença.
 */
function getMonthlyExpenseComparisonData() {
    // 1. Inicializações
    const monthlyTotals = {};
    const monthlyCategoryDetails = {};
    const expensesByMonth = {}; // Objeto para armazenar as despesas por mês (usado para checar "pago")



    // Note: rawData precisa estar definida no escopo global
    rawData.forEach(d => {
        // Assume o ano atual para simplificar, se 'ano' não for um campo em 'd'
        const ano = d.ano || CURRENT_YEAR; 
        const mesChave = `${ano}-${String(d.mes).padStart(2, '0')}`;
        
        // Exclui recorrência anual para a evolução de gastos recorrentes/únicos
        const recurrence = String(d.recorrencia || '').toLowerCase().trim();
        if (recurrence === 'anual') return;

        // Calcula total (Projetado)
        monthlyTotals[mesChave] = (monthlyTotals[mesChave] || 0) + d.valor;

        // 🚨 CRÍTICO: Popular expensesByMonth
        if (!expensesByMonth[mesChave]) {
             expensesByMonth[mesChave] = [];
        }
        expensesByMonth[mesChave].push(d); 

        // Agrupa por categoria para análise de variação (mantido no primeiro loop para ser mais eficiente)
        if (!monthlyCategoryDetails[mesChave]) {
            monthlyCategoryDetails[mesChave] = {};
        }
        monthlyCategoryDetails[mesChave][d.categoria] = (monthlyCategoryDetails[mesChave][d.categoria] || 0) + d.valor;
    }); // <<<< FIM CORRETO DO LOOP rawData.forEach

    // 2. Classifica os meses e calcula as diferenças/tooltips
    const sortedKeys = Object.keys(monthlyTotals).sort();
 
    const result = {
        meses: [],
        gastos: [],
        gastosPagos: [],
        tooltips: [], 
        pendingLists: [], // Array para a lista de pendentes
        // 🚨 CORREÇÃO CRÍTICA: ADICIONE ESTA LINHA!
        percentDiffs: []
    };

    

    let previousMonthTotal = 0;

    for (let i = 0; i < sortedKeys.length; i++) {
        const mesChave = sortedKeys[i];
        const currentTotal = monthlyTotals[mesChave]; // Gasto TOTAL do mês (já calculado)
        let currentPaidTotal = 0;

        // Pega todas as despesas do mês
        const expensesOfMonth = expensesByMonth[mesChave] || [];
        let pendingItemsList = []; // Array temporário para os itens pendentes do mês

        // Itera sobre as despesas do mês para calcular Pago/Pendente
        expensesOfMonth.forEach(d => {
            if (d.status && d.status.toLowerCase() === 'pago') {
                currentPaidTotal += d.valor;
            } else {
                // Formata e armazena o item pendente
                const formattedValue = formatCurrency(d.valor); 
                pendingItemsList.push(`• ${capitalize(d.categoria)} (R$ ${formattedValue})`);
            }
        });
        
        // --- Lógica de cálculo de diffExplanation (Variação com Mês Anterior) ---
        
        let diffExplanation = 'Primeiro mês com dados registrados.';
        let percentDiff = 0; // 🚨 NOVO: Declare percentDiff com valor padrão de 0
        
        if (i > 0) {
            const previousMesChave = sortedKeys[i - 1];

            if (previousMonthTotal > 0) {
                // Cálculo da diferença percentual
                let percentDiff = ((currentTotal - previousMonthTotal) / previousMonthTotal) * 100;
                
                // --- Análise Detalhada da Diferença por Categoria ---
                const prevCats = monthlyCategoryDetails[previousMesChave] || {};
                const currCats = monthlyCategoryDetails[mesChave] || {};
                
                const categoryDifferences = {};
                const allCategories = new Set([...Object.keys(prevCats), ...Object.keys(currCats)]);
                
                // Calcula a variação absoluta por categoria
                allCategories.forEach(cat => {
                    const diff = (currCats[cat] || 0) - (prevCats[cat] || 0);
                    if (Math.abs(diff) > 0.01) {
                        categoryDifferences[cat] = diff;
                    }
                });

                // Classifica e pega os 3 principais contribuintes (em valor absoluto)
                const sortedDiffs = Object.entries(categoryDifferences)
                    .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
                    .slice(0, 3); 

                let changeType = percentDiff >= 0 ? 'aumento' : 'redução';
                let diffText = '';

                
                percentDiff = ((currentTotal - previousMonthTotal) / previousMonthTotal) * 100; // Apenas atribui o valor
            

                if (Math.abs(percentDiff) < 0.1) {
                     diffExplanation = 'Sem variação significativa.';
                } else {
                     diffText = `Variação: <b>${percentDiff.toFixed(2)}%</b> (${changeType} em relação ao mês anterior).<br><br>Principais contribuições:<br>`;
                    
                     if(sortedDiffs.length > 0) {
                        sortedDiffs.forEach(([cat, diff]) => {
                            const sign = diff >= 0 ? '+' : ''; 
                            const action = diff >= 0 ? 'aumento' : 'redução';
                            
                            diffText += `• ${capitalize(cat)}: ${sign}${formatCurrency(diff)} (${action})<br>`;
                        });
                     } else {
                         diffText += 'Ajustes pequenos em múltiplas categorias.';
                     }
                    
                     diffExplanation = diffText;
                }
            } else if (currentTotal > 0) {
                 diffExplanation = 'Gasto registrado. Mês anterior zerado.';
            } else {
                diffExplanation = 'Sem variação.';
            }
        }
        
        // Armazena os resultados no objeto final (result)
        result.meses.push(mesChave);
        result.gastos.push(currentTotal);
        result.tooltips.push(diffExplanation);
        result.gastosPagos.push(currentPaidTotal);
        result.percentDiffs.push(percentDiff);

        // Armazena a lista formatada final de pendentes
        if (pendingItemsList.length > 0) {
            result.pendingLists.push(pendingItemsList.join('<br>'));
        } else {
            result.pendingLists.push('Nenhum item pendente.');
        }

        previousMonthTotal = currentTotal;
    }

    return result;
}

// ===================================
// FUNÇÃO DE INICIALIZAÇÃO DE DADOS (PARA DADOS REAIS)
// ===================================

function initializeDashboardData() {
    // 1. Lógica de Carregamento de Dados (Reais)
    // É CRÍTICO que suas funções de carregamento de despesas e receitas do 
    // LocalStorage (ou outro local) sejam chamadas AQUI e preencham o 'rawData' e 'rawRevenues'.

    // Exemplo: Chame suas funções de carregamento aqui.
    // Ex: loadAllExpensesFromLocalStorage(); 
    // Ex: loadAllRevenuesFromLocalStorage();
    
    // Assumindo que você tem uma função para carregar investimentos
    if (typeof carregarDadosInvestimentos === 'function') {
        carregarDadosInvestimentos(); 
    }

    // 2. Chama a função principal de processamento para calcular e desenhar o dashboard
    if (typeof processData === 'function') {
        processData();
    }
}


function carregarDadosInvestimentos() {
    const dadosSalvos = localStorage.getItem(STORAGE_KEY_APORTE);
    if (dadosSalvos) {
        // Converte a string JSON de volta para objeto
        dadosInvestimentos = JSON.parse(dadosSalvos);
    } else {
        // Inicializa o objeto se não houver dados salvos
        dadosInvestimentos = {};
    }
}

/**
 * Calcula o total de receita RECEBIDA para cada mês (1 a 12) do ano atual.
 * @param {Array<Object>} rawRevenues O array de dados brutos de receita.
 * @returns {Array<number>} Um array de 12 posições com o total de receita recebida por mês.
 */
function calculateMonthlyRevenueTotals(rawRevenues) {
    // Inicializa 12 posições com 0 (para os meses de Jan a Dez)
    const monthlyRevenueTotals = Array(12).fill(0);
    
    // Assume que MONTH_NAMES_SHORT e CURRENT_YEAR estão definidos globalmente
    if (!rawRevenues || rawRevenues.length === 0) {
        return monthlyRevenueTotals;
    }

    rawRevenues.forEach(d => {
        // Assume que 'mes' é um número (1 a 12)
        const mes = parseInt(d.mes); 
        
        // Opcional: Filtra por status 'recebido' ou similar, se houver
        const status = String(d.status || '').toLowerCase().trim();
        const valor = parseFloat(d.valor) || 0; // Garante que é um número
        
        // Verifica se é um mês válido e se o status é 'recebido'
        // NOTA: Se você não tiver status, remova a condição 'status === "recebido"'
        if (mes >= 1 && mes <= 12 && status === 'recebido') { 
            monthlyRevenueTotals[mes - 1] += valor;
        }
    });

    return monthlyRevenueTotals;
}

/**
 * Alterna o modo de faixa do eixo Y entre 'tozero' (fixa) e 'normal' (ajustável).
 * @param {string} mode O modo desejado ('tozero' ou 'normal').
 */
function toggleYAxisRangeMode(mode) {
    const graficoDiv = document.getElementById('grafico-evolucao-mensal');
    if (!graficoDiv || !graficoDiv.data) {
        console.error("Gráfico não inicializado.");
        return;
    }

    const update = {
        'yaxis.rangemode': mode
    };
    
    // O Plotly.relayout atualiza o gráfico sem redesenhá-lo do zero
    Plotly.relayout(graficoDiv, update)
        .then(() => {
            console.log(`Eixo Y alterado para: ${mode}`);
        });
}