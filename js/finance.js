/**
 * Project Finance Management Controller
 * Handles interactions for the Finance Dashboard
 */

document.addEventListener('DOMContentLoaded', () => {
    // Wait a brief moment to ensure all elements are rendered
    setTimeout(() => {
        initFinanceDashboard();
    }, 500);
});

function initFinanceDashboard() {
    // 1. Transaction Tabs Filtering
    const tabs = document.querySelectorAll('#view-accounting .border-b .px-6');
    const tableRows = document.querySelectorAll('#view-accounting tbody tr');

    if (tabs.length > 0) {
        tabs.forEach((tab, index) => {
            tab.addEventListener('click', () => {
                // Reset all tabs
                tabs.forEach(t => {
                    t.classList.remove('text-blue-600', 'border-blue-600');
                    t.classList.add('text-gray-500', 'hover:text-gray-700', 'hover:bg-gray-100');
                    t.style.borderBottomWidth = '0px';
                });

                // Set active tab
                tab.classList.remove('text-gray-500', 'hover:text-gray-700', 'hover:bg-gray-100');
                tab.classList.add('text-blue-600', 'border-blue-600');
                tab.style.borderBottomWidth = '2px';

                // Filter table rows
                const filterType = index; // 0: All, 1: Credit, 2: Cash, 3: Pending
                
                tableRows.forEach(row => {
                    if (filterType === 0) {
                        row.style.display = ''; // Show all
                    } else if (filterType === 1) {
                        // Credit
                        const typeCell = row.querySelector('td:nth-child(4)').innerText;
                        row.style.display = typeCell.includes('Credit') ? '' : 'none';
                    } else if (filterType === 2) {
                        // Cash
                        const typeCell = row.querySelector('td:nth-child(4)').innerText;
                        row.style.display = typeCell.includes('Cash') ? '' : 'none';
                    } else if (filterType === 3) {
                        // Pending
                        const statusCell = row.querySelector('td:nth-child(6)').innerText;
                        row.style.display = statusCell.includes('รออนุมัติ') ? '' : 'none';
                    }
                });
            });
        });
        
        // Ensure first tab has correct border
        tabs[0].style.borderBottomWidth = '2px';
    }

    // 2. Summary Cards Click -> Filter Tabs
    const summaryCards = document.querySelectorAll('#view-accounting .grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-5 > div');
    if (summaryCards.length === 5) {
        // Card 1: Credit -> Click triggers Tab 1 (Credit)
        summaryCards[0].addEventListener('click', () => {
            tabs[1].click();
            scrollToTable();
        });
        
        // Card 2: Cash Used -> Click triggers Tab 2 (Cash)
        summaryCards[1].addEventListener('click', () => {
            tabs[2].click();
            scrollToTable();
        });

        // Card 3: Cash Remaining -> Alert detail
        summaryCards[2].addEventListener('click', () => {
            alert('Cash Balance Detail\nเงินสดตั้งต้น: ฿8,000\nเงินเข้า: ฿2,000\nเงินออก: ฿4,000\nเงินสดคงเหลือ: ฿6,000');
        });

        // Card 4: Pending -> Click triggers Tab 3 (Pending)
        summaryCards[3].addEventListener('click', () => {
            tabs[3].click();
            scrollToTable();
        });

        // Card 5: Approved -> Alert detail
        summaryCards[4].addEventListener('click', () => {
            alert('Approved Budget Detail\nแสดงรายการที่อนุมัติแล้วทั้งหมดเตรียมเบิกจ่าย');
        });
        
        // Make cards look clickable
        summaryCards.forEach(card => {
            card.classList.add('cursor-pointer');
        });
    }

    // 3. Header Buttons
    const headerButtons = document.querySelectorAll('#view-accounting .flex.items-center.gap-3 > button');
    if (headerButtons.length >= 3) {
        // Add Transaction
        headerButtons[0].addEventListener('click', () => {
            openFinanceModal('finance-add-modal');
        });
        
        // Request Budget
        headerButtons[1].addEventListener('click', () => {
            openFinanceModal('finance-request-modal');
        });
        
        // Export Report
        headerButtons[2].addEventListener('click', () => {
            openFinanceModal('finance-export-modal');
        });
    }

    // 4. "ดูรายละเอียดทั้งหมด" links
    const viewAllLinks = document.querySelectorAll('#view-accounting button.text-blue-600, #view-accounting button.text-green-600');
    viewAllLinks.forEach(link => {
        if (link.innerText.includes('ดูรายละเอียดทั้งหมด')) {
            link.addEventListener('click', (e) => {
                if (link.classList.contains('text-blue-600')) {
                    // Credit Donut view all
                    tabs[1].click();
                    scrollToTable();
                } else if (link.classList.contains('text-green-600')) {
                    // Cash Donut view all
                    tabs[2].click();
                    scrollToTable();
                }
            });
        }
    });

    // 5. Tooltip interaction for Progress bar
    const progressBarContainer = document.querySelector('#view-accounting .h-8.rounded-lg.overflow-hidden');
    if (progressBarContainer) {
        progressBarContainer.addEventListener('click', () => {
            alert('Utilization: 42.25%\nCredit Budget: ฿20,000\nCash Used: ฿8,450');
        });
        progressBarContainer.classList.add('cursor-pointer');
    }

    // 6. Transaction Detail Side Panel
    const detailButtons = document.querySelectorAll('#view-accounting tbody button');
    detailButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            if (row) {
                const title = row.querySelector('td:nth-child(2)').innerText;
                const amount = row.querySelector('td:nth-child(5)').innerText;
                const typeCell = row.querySelector('td:nth-child(4)').innerText;
                const statusCell = row.querySelector('td:nth-child(6)').innerText;
                const categoryCell = row.querySelector('td:nth-child(3)').innerHTML;
                const dateCell = row.querySelector('td:nth-child(1)').innerText;
                const userCell = row.querySelector('td:nth-child(7)').innerHTML;
                
                openFinancePanel(title, amount, typeCell, statusCell, categoryCell, dateCell, userCell);
            }
        });
    });
}

function scrollToTable() {
    const tableContainer = document.querySelector('#view-accounting .bg-white.rounded-2xl.border.border-gray-100.overflow-hidden.flex.flex-col.flex-1');
    if (tableContainer) {
        tableContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Modal Functions
function openFinanceModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function closeFinanceModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
    }
}

function toggleFinanceAddType() {
    const type = document.querySelector('input[name="finance_add_type"]:checked').value;
    const creditField = document.getElementById('field-credit-owner');
    const cashField = document.getElementById('field-cash-payer');
    const dateLabel = document.getElementById('label-date-add');
    
    if (type === 'credit') {
        creditField.classList.remove('hidden');
        cashField.classList.add('hidden');
        dateLabel.innerHTML = 'วันที่วางแผน/ขออนุมัติ <span class="text-red-500">*</span>';
    } else {
        creditField.classList.add('hidden');
        cashField.classList.remove('hidden');
        dateLabel.innerHTML = 'วันที่เกิดรายการจริง <span class="text-red-500">*</span>';
    }
}

// Side Panel Functions
function openFinancePanel(title, amount, type, status, categoryHTML, date, userHTML) {
    const panel = document.getElementById('finance-detail-panel');
    const content = document.getElementById('finance-detail-content');
    
    if (panel && content) {
        // Update data
        document.getElementById('panel-title').innerText = title || 'รายละเอียดรายการ';
        document.getElementById('panel-amount').innerText = amount || '฿0.00';
        
        // Update badges
        const badgesContainer = document.getElementById('panel-badges');
        badgesContainer.innerHTML = '';
        
        if (type && type.includes('Credit')) {
            badgesContainer.innerHTML += `<span class="bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-lg text-xs font-bold">Credit</span>`;
            document.getElementById('panel-icon').innerHTML = '<i class="fa-solid fa-wallet"></i>';
            document.getElementById('panel-icon').className = 'inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 text-blue-600 mb-3 text-xl';
        } else if (type && type.includes('Cash')) {
            badgesContainer.innerHTML += `<span class="bg-green-50 text-green-700 border border-green-200 px-3 py-1 rounded-lg text-xs font-bold">Cash</span>`;
            document.getElementById('panel-icon').innerHTML = '<i class="fa-solid fa-hand-holding-dollar"></i>';
            document.getElementById('panel-icon').className = 'inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-50 text-green-600 mb-3 text-xl';
        }

        const approvalActions = document.getElementById('panel-approval-actions');
        if (status && status.includes('รออนุมัติ')) {
            badgesContainer.innerHTML += `<span class="bg-orange-50 text-orange-600 border border-orange-200 px-3 py-1 rounded-lg text-xs font-bold">รออนุมัติ</span>`;
            approvalActions.classList.remove('hidden');
        } else if (status && status.includes('อนุมัติแล้ว')) {
            badgesContainer.innerHTML += `<span class="bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1 rounded-lg text-xs font-bold">อนุมัติแล้ว</span>`;
            approvalActions.classList.add('hidden');
        } else if (status && status.includes('จ่ายแล้ว')) {
            badgesContainer.innerHTML += `<span class="bg-green-100 text-green-700 border border-green-200 px-3 py-1 rounded-lg text-xs font-bold">จ่ายแล้ว</span>`;
            approvalActions.classList.add('hidden');
        } else {
            approvalActions.classList.add('hidden');
        }
        
        // Category, Date, User
        if (categoryHTML) document.getElementById('panel-category').innerHTML = categoryHTML;
        if (date) document.getElementById('panel-date').innerText = date;
        if (userHTML) document.getElementById('panel-user').innerHTML = userHTML;

        // Show panel
        panel.classList.remove('hidden');
        // Slight delay to allow display:block to apply before animating transform
        setTimeout(() => {
            content.classList.remove('translate-x-full');
        }, 10);
    }
}

function closeFinancePanel() {
    const panel = document.getElementById('finance-detail-panel');
    const content = document.getElementById('finance-detail-content');
    
    if (panel && content) {
        content.classList.add('translate-x-full');
        setTimeout(() => {
            panel.classList.add('hidden');
        }, 300); // Wait for transition
    }
}

// Form Submission Handling
document.addEventListener('DOMContentLoaded', () => {
    // Wait for the modal elements to be in DOM
    setTimeout(() => {
        const addBtn = document.querySelector('#finance-add-modal button.bg-blue-600');
        if (addBtn) {
            addBtn.addEventListener('click', submitFinanceTransaction);
        }
        
        const addCategoryBtn = document.getElementById('btn-submit-category');
        if (addCategoryBtn) {
            addCategoryBtn.addEventListener('click', submitFinanceCategory);
        }
    }, 1000);
});

async function submitFinanceTransaction() {
    const modal = document.getElementById('finance-add-modal');
    
    // 1. Gather Data
    const type = document.querySelector('input[name="finance_add_type"]:checked').value;
    const titleInput = modal.querySelectorAll('input[type="text"]')[0].value;
    const categorySelect = modal.querySelector('select').value;
    const amountInput = modal.querySelector('input[type="number"]').value;
    const dateInput = modal.querySelector('input[type="date"]').value;
    
    // Basic Validation
    if (!titleInput || !categorySelect || !amountInput || !dateInput) {
        alert('กรุณากรอกข้อมูลที่จำเป็น (*) ให้ครบถ้วน');
        return;
    }
    
    try {
        // Change button state
        const submitBtn = modal.querySelector('button.bg-blue-600');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...';
        submitBtn.disabled = true;
        
        // 2. Call API Service
        const data = {
            title: titleInput,
            category: categorySelect,
            amount: parseFloat(amountInput),
            transaction_type: type,
            transaction_date: dateInput
        };
        
        const result = await ApiService.createFinanceTransaction(data);
        
        // 3. Inject new row into the table (Mocking UI update)
        insertTransactionRow(result);
        
        // 4. Reset & Close
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        
        // Reset file input
        const fileInput = document.getElementById('finance-attachment-add');
        if (fileInput) fileInput.value = '';
        const fileUI = document.getElementById('finance-attachment-add-ui');
        if (fileUI) {
            fileUI.innerHTML = `
                <i class="fa-solid fa-cloud-arrow-up text-3xl text-gray-400 mb-2 group-hover:text-blue-500 transition-colors"></i>
                <p class="text-sm text-blue-600 font-medium">คลิกเพื่ออัปโหลดไฟล์</p>
                <p class="text-xs text-gray-400 mt-1">หรือลากไฟล์มาวางที่นี่</p>
            `;
        }
        
        closeFinanceModal('finance-add-modal');
        alert('บันทึกรายการสำเร็จ!');
        
    } catch (error) {
        console.error(error);
        alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
}

function insertTransactionRow(data) {
    const tbody = document.querySelector('#view-accounting tbody');
    if (!tbody) return;
    
    // Map categories for UI
    const catMap = {
        'welfare': { name: 'สวัสดิการ', icon: 'fa-utensils', color: 'orange' },
        'supplies': { name: 'พัสดุ', icon: 'fa-box', color: 'purple' },
        'activity': { name: 'กิจกรรม', icon: 'fa-palette', color: 'pink' },
        'travel': { name: 'เดินทาง', icon: 'fa-car', color: 'sky' },
        'other': { name: 'อื่นๆ', icon: 'fa-ellipsis', color: 'gray' }
    };
    
    const cat = catMap[data.category] || catMap['other'];
    const formattedDate = new Date(data.transaction_date).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const formattedAmount = '฿' + data.amount.toLocaleString(undefined, { minimumFractionDigits: 0 });
    
    let typeBadge, statusBadge;
    if (data.transaction_type === 'credit') {
        typeBadge = `<span class="bg-blue-50 text-blue-600 border border-blue-100 px-2 py-1 rounded text-[10px] font-bold tracking-wide">Credit</span>`;
        statusBadge = `<span class="bg-orange-50 text-orange-600 px-2.5 py-1 rounded-md text-[10px] font-bold border border-orange-100">รออนุมัติ</span>`;
    } else {
        typeBadge = `<span class="bg-green-50 text-green-600 border border-green-100 px-2 py-1 rounded text-[10px] font-bold tracking-wide">Cash</span>`;
        statusBadge = `<span class="bg-green-100 text-green-700 px-2.5 py-1 rounded-md text-[10px] font-bold border border-green-200">จ่ายแล้ว</span>`;
    }
    
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50 transition-colors animate-fade-in-up bg-yellow-50'; // highlight new row
    
    tr.innerHTML = `
        <td class="px-6 py-4 text-xs text-gray-500">${formattedDate}</td>
        <td class="px-6 py-4 font-medium text-gray-800">${data.title}</td>
        <td class="px-6 py-4">
            <div class="flex items-center gap-2">
                <i class="fa-solid ${cat.icon} text-${cat.color}-400 w-4 text-center"></i> <span class="text-xs">${cat.name}</span>
            </div>
        </td>
        <td class="px-6 py-4 text-center">${typeBadge}</td>
        <td class="px-6 py-4 text-right font-bold text-gray-800">${formattedAmount}</td>
        <td class="px-6 py-4 text-center">${statusBadge}</td>
        <td class="px-6 py-4">
            <div class="flex items-center gap-2">
                <img src="https://ui-avatars.com/api/?name=You&background=random" class="w-6 h-6 rounded-full border border-gray-200">
                <span class="text-xs text-gray-600">คุณ (Me)</span>
            </div>
        </td>
        <td class="px-6 py-4 text-center"><button class="text-gray-400 hover:text-blue-500 transition-colors" onclick="this.closest('tr').click()"><i class="fa-regular fa-comment-dots"></i></button></td>
    `;
    
    // Add click event for the new row to open Side panel
    tr.addEventListener('click', () => {
        openFinancePanel(data.title, formattedAmount, typeBadge, statusBadge, tr.querySelector('td:nth-child(3)').innerHTML, formattedDate, tr.querySelector('td:nth-child(7)').innerHTML);
    });
    
    // Prepend to top of table
    tbody.insertBefore(tr, tbody.firstChild);
    
    // Remove highlight after a few seconds
    setTimeout(() => {
        tr.classList.remove('bg-yellow-50');
    }, 3000);
}

// Category Submission
async function submitFinanceCategory() {
    const modal = document.getElementById('finance-add-category-modal');
    
    // Gather Data
    const nameInput = document.getElementById('add-category-name').value.trim();
    const iconInput = document.getElementById('add-category-icon').value.trim() || 'fa-box';
    const colorInput = document.querySelector('input[name="category_color"]:checked').value;
    
    if (!nameInput) {
        alert('กรุณากรอกชื่อหมวดหมู่');
        return;
    }
    
    try {
        const submitBtn = document.getElementById('btn-submit-category');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...';
        submitBtn.disabled = true;
        
        const data = {
            name: nameInput,
            icon: iconInput,
            color: colorInput
        };
        
        const result = await ApiService.createFinanceCategory(data);
        
        // Update Select dropdowns in Modals
        const valueSlug = 'cat_' + Date.now();
        const selects = document.querySelectorAll('#finance-add-modal select, #finance-request-modal select');
        
        selects.forEach(select => {
            // Find if it's the category select (usually the one with options welfare, supplies, etc.)
            const isCategorySelect = Array.from(select.options).some(opt => opt.value === 'welfare' || opt.value === 'supplies');
            if (isCategorySelect) {
                const newOption = new Option(result.name, valueSlug);
                select.add(newOption);
            }
        });
        
        // Add to Breakdown list
        insertCategoryBreakdown(result);
        
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        
        // Reset form
        document.getElementById('add-category-name').value = '';
        
        closeFinanceModal('finance-add-category-modal');
        alert('เพิ่มหมวดหมู่สำเร็จ!');
        
    } catch (error) {
        console.error(error);
        alert('เกิดข้อผิดพลาดในการบันทึกหมวดหมู่');
    }
}

function insertCategoryBreakdown(data) {
    // Find the breakdown container
    const breakdownContainers = document.querySelectorAll('#view-accounting .space-y-5.overflow-y-auto.flex-1.pr-1.custom-scrollbar');
    if (breakdownContainers.length === 0) return;
    
    const container = breakdownContainers[0];
    
    // Build new category HTML
    const bgColors = {
        'red': 'bg-red-100', 'orange': 'bg-orange-100', 'yellow': 'bg-yellow-100',
        'green': 'bg-green-100', 'blue': 'bg-blue-100', 'indigo': 'bg-indigo-100',
        'purple': 'bg-purple-100', 'pink': 'bg-pink-100', 'gray': 'bg-gray-100'
    };
    
    const textColors = {
        'red': 'text-red-500', 'orange': 'text-orange-500', 'yellow': 'text-yellow-600',
        'green': 'text-green-500', 'blue': 'text-blue-500', 'indigo': 'text-indigo-500',
        'purple': 'text-purple-500', 'pink': 'text-pink-500', 'gray': 'text-gray-500'
    };
    
    const bgColorClass = bgColors[data.color] || 'bg-gray-100';
    const textColorClass = textColors[data.color] || 'text-gray-500';
    
    const newDiv = document.createElement('div');
    newDiv.className = 'animate-fade-in-up';
    newDiv.innerHTML = `
        <div class="flex items-center justify-between text-[11px] mb-2 cursor-pointer group hover:bg-gray-50 p-1 -mx-1 rounded transition-colors bg-yellow-50" onclick="if(this.nextElementSibling.nextElementSibling.nextElementSibling) this.nextElementSibling.nextElementSibling.nextElementSibling.classList.toggle('hidden');">
            <div class="w-2/5 flex items-center gap-2.5 font-medium text-gray-700">
                <div class="w-6 h-6 rounded ${bgColorClass} flex items-center justify-center shrink-0"><i class="fa-solid ${data.icon} ${textColorClass} text-[10px]"></i></div>
                <span class="truncate">${data.name}</span>
            </div>
            <div class="w-1/5 text-right text-gray-500">฿0</div>
            <div class="w-1/5 text-right text-gray-500">฿0</div>
            <div class="w-1/5 text-right font-bold text-gray-800">฿0</div>
        </div>
        <div class="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden flex">
            <div class="bg-gray-200 h-full" style="width: 100%;"></div>
        </div>
        <div class="text-[9px] text-gray-400 text-right mt-1">ยังไม่มีการใช้งาน</div>
    `;
    
    // Add to top of list
    container.insertBefore(newDiv, container.firstChild);
    
    // Remove highlight
    setTimeout(() => {
        const header = newDiv.querySelector('.bg-yellow-50');
        if (header) header.classList.remove('bg-yellow-50');
    }, 3000);
}

// File Attachment Handler
function handleFinanceAttachmentChange(input) {
    const uiContainer = document.getElementById('finance-attachment-add-ui');
    if (!uiContainer) return;
    
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const fileSize = (file.size / 1024 / 1024).toFixed(2); // in MB
        
        // Determine icon based on type
        let iconClass = 'fa-file-lines';
        let iconColor = 'text-gray-500';
        
        if (file.type.includes('image')) {
            iconClass = 'fa-file-image';
            iconColor = 'text-blue-500';
        } else if (file.type.includes('pdf')) {
            iconClass = 'fa-file-pdf';
            iconColor = 'text-red-500';
        }
        
        uiContainer.innerHTML = `
            <div class="flex items-center justify-center gap-3">
                <i class="fa-solid ${iconClass} text-3xl ${iconColor}"></i>
                <div class="text-left">
                    <p class="text-sm font-bold text-gray-800 truncate max-w-[200px]">${file.name}</p>
                    <p class="text-xs text-gray-500">${fileSize} MB</p>
                </div>
            </div>
            <p class="text-[10px] text-blue-600 mt-3 font-medium hover:underline">คลิกเพื่อเปลี่ยนไฟล์</p>
        `;
    } else {
        // Reset UI if no file
        uiContainer.innerHTML = `
            <i class="fa-solid fa-cloud-arrow-up text-3xl text-gray-400 mb-2 group-hover:text-blue-500 transition-colors"></i>
            <p class="text-sm text-blue-600 font-medium">คลิกเพื่ออัปโหลดไฟล์</p>
            <p class="text-xs text-gray-400 mt-1">หรือลากไฟล์มาวางที่นี่</p>
        `;
    }
}
