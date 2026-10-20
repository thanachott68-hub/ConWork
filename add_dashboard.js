const fs = require('fs');
const path = require('path');

const indexHtmlPath = path.join(__dirname, 'index.html');
let indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

// 1. Add Sidebar Link
const sidebarLinkRegex = /<nav class="flex-1 py-6 px-4 space-y-2 overflow-y-auto overflow-x-hidden custom-scrollbar">/;
if (!indexHtml.includes('data-view="dashboard"')) {
    const dashboardLink = `
                <a href="#"
                    class="nav-item flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800 transition-colors"
                    data-view="dashboard">
                    <i class="fa-solid fa-chart-line w-5 flex-shrink-0"></i>
                    <span
                        class="font-medium sidebar-text whitespace-nowrap transition-opacity duration-300">แดชบอร์ด</span>
                </a>`;
    indexHtml = indexHtml.replace(sidebarLinkRegex, `$&${dashboardLink}`);
}

// 2. Add Dashboard View Section
const viewSectionRegex = /<!-- Dynamic Views Container -->\s*<div class="flex-1 overflow-hidden p-6 flex flex-col">/;
if (!indexHtml.includes('id="view-dashboard"')) {
    const dashboardHTML = `
                <!-- 0. DASHBOARD VIEW (Personal) -->
                <div id="view-dashboard" class="view-section h-full flex flex-col overflow-y-auto hidden custom-scrollbar pb-24">
                    
                    <!-- 1. Top Header Section -->
                    <div class="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 px-2">
                        <div>
                            <h2 class="text-3xl font-bold text-gray-800">สวัสดีตอนเช้า, พิมพ์ชนก 👋</h2>
                            <p class="text-gray-500 mt-1 cursor-pointer hover:text-gray-700 transition">วันนี้เป็นวันที่ดีสำหรับการทำงานให้สำเร็จ!</p>
                        </div>
                        <button class="flex items-center gap-2 bg-white border border-gray-200 px-4 py-2.5 rounded-xl shadow-sm hover:shadow-md hover:bg-gray-50 transition-all text-gray-700 active:scale-95">
                            <i class="fa-regular fa-calendar text-lg"></i>
                            <span class="font-medium text-sm">พฤหัสบดีที่ 23 พฤษภาคม 2567</span>
                        </button>
                    </div>

                    <!-- 2. Summary Cards (Horizontal Scroll) -->
                    <div class="flex overflow-x-auto gap-4 pb-4 px-2 -mx-2 custom-scrollbar snap-x">
                        
                        <!-- Card 1 -->
                        <div class="min-w-[220px] bg-white rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-gray-100 flex-shrink-0 cursor-pointer hover:shadow-lg transition-all active:scale-95 snap-start">
                            <div class="flex gap-4 items-center">
                                <div class="w-14 h-14 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500 text-2xl">
                                    <i class="fa-solid fa-clipboard-list"></i>
                                </div>
                                <div>
                                    <h3 class="text-gray-500 text-sm font-medium mb-0.5">งานทั้งหมด</h3>
                                    <div class="text-3xl font-bold text-gray-800">64<span class="text-sm font-normal text-gray-500 ml-1">งาน</span></div>
                                    <div class="text-green-500 text-xs font-medium mt-1 flex items-center gap-1"><i class="fa-solid fa-arrow-trend-up"></i> +12 จากสัปดาห์ที่แล้ว</div>
                                </div>
                            </div>
                        </div>

                        <!-- Card 2 -->
                        <div class="min-w-[220px] bg-white rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-gray-100 flex-shrink-0 cursor-pointer hover:shadow-lg transition-all active:scale-95 snap-start">
                            <div class="flex gap-4 items-center">
                                <div class="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500 text-2xl">
                                    <i class="fa-solid fa-clock-rotate-left"></i>
                                </div>
                                <div>
                                    <h3 class="text-gray-500 text-sm font-medium mb-0.5">งานที่กำลังทำ</h3>
                                    <div class="text-3xl font-bold text-gray-800">28<span class="text-sm font-normal text-gray-500 ml-1">งาน</span></div>
                                    <div class="text-green-500 text-xs font-medium mt-1 flex items-center gap-1"><i class="fa-solid fa-arrow-trend-up"></i> +8 จากสัปดาห์ที่แล้ว</div>
                                </div>
                            </div>
                        </div>

                        <!-- Card 3 -->
                        <div class="min-w-[220px] bg-white rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-gray-100 flex-shrink-0 cursor-pointer hover:shadow-lg transition-all active:scale-95 snap-start">
                            <div class="flex gap-4 items-center">
                                <div class="w-14 h-14 rounded-xl bg-green-50 flex items-center justify-center text-green-500 text-2xl">
                                    <i class="fa-solid fa-check-circle"></i>
                                </div>
                                <div>
                                    <h3 class="text-gray-500 text-sm font-medium mb-0.5">งานที่เสร็จสิ้น</h3>
                                    <div class="text-3xl font-bold text-gray-800">18<span class="text-sm font-normal text-gray-500 ml-1">งาน</span></div>
                                    <div class="text-green-500 text-xs font-medium mt-1 flex items-center gap-1"><i class="fa-solid fa-arrow-trend-up"></i> +15 จากสัปดาห์ที่แล้ว</div>
                                </div>
                            </div>
                        </div>

                        <!-- Card 4 -->
                        <div class="min-w-[220px] bg-white rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-gray-100 flex-shrink-0 cursor-pointer hover:shadow-lg transition-all active:scale-95 snap-start">
                            <div class="flex gap-4 items-center">
                                <div class="w-14 h-14 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500 text-2xl">
                                    <i class="fa-regular fa-folder-open"></i>
                                </div>
                                <div>
                                    <h3 class="text-gray-500 text-sm font-medium mb-0.5">งานที่ค้าง</h3>
                                    <div class="text-3xl font-bold text-gray-800">12<span class="text-sm font-normal text-gray-500 ml-1">งาน</span></div>
                                    <div class="text-red-500 text-xs font-medium mt-1 flex items-center gap-1"><i class="fa-solid fa-arrow-trend-down"></i> -3 จากสัปดาห์ที่แล้ว</div>
                                </div>
                            </div>
                        </div>

                        <!-- Card 5 -->
                        <div class="min-w-[220px] bg-white rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-gray-100 flex-shrink-0 cursor-pointer hover:shadow-lg transition-all active:scale-95 snap-start">
                            <div class="flex gap-4 items-center">
                                <div class="w-14 h-14 rounded-xl bg-red-50 flex items-center justify-center text-red-500 text-2xl">
                                    <i class="fa-regular fa-flag"></i>
                                </div>
                                <div>
                                    <h3 class="text-gray-500 text-sm font-medium mb-0.5">ใกล้ถึงกำหนด</h3>
                                    <div class="text-3xl font-bold text-gray-800">7<span class="text-sm font-normal text-gray-500 ml-1">งาน</span></div>
                                    <div class="text-red-500 text-xs font-medium mt-1 flex items-center gap-1"><i class="fa-regular fa-clock"></i> ภายใน 3 วัน</div>
                                </div>
                            </div>
                        </div>

                    </div>

                    <!-- 3. Middle Section (Charts) -->
                    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8 px-2 mt-4">
                        
                        <!-- Donut Chart -->
                        <div class="lg:col-span-4 bg-white rounded-2xl p-6 shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-gray-100 cursor-pointer hover:shadow-lg transition-all">
                            <div class="flex justify-between items-center mb-8">
                                <h3 class="text-lg font-bold text-gray-800">ภาพรวมความคืบหน้า</h3>
                                <button class="text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors">
                                    ทุกโปรเจกต์ <i class="fa-solid fa-chevron-down text-xs"></i>
                                </button>
                            </div>
                            
                            <div class="flex flex-col items-center justify-center">
                                <div class="relative w-48 h-48 mb-6">
                                    <div class="w-full h-full rounded-full" style="background: conic-gradient(#4285F4 0% 28%, #34A853 28% 72%, #FBBC05 72% 91%, #EA4335 91% 100%);"></div>
                                    <div class="absolute inset-4 bg-white rounded-full flex flex-col items-center justify-center shadow-inner">
                                        <span class="text-3xl font-bold text-gray-800">64%</span>
                                        <span class="text-xs text-gray-500 font-medium">ความคืบหน้ารวม</span>
                                    </div>
                                </div>
                                
                                <div class="w-full space-y-3 px-4">
                                    <div class="flex justify-between items-center text-sm">
                                        <div class="flex items-center gap-2 text-gray-700 font-medium"><div class="w-3 h-3 rounded-full bg-[#4285F4]"></div> Completed</div>
                                        <div><span class="font-bold text-gray-800">18</span> <span class="text-gray-400 text-xs ml-1">(28%)</span></div>
                                    </div>
                                    <div class="flex justify-between items-center text-sm">
                                        <div class="flex items-center gap-2 text-gray-700 font-medium"><div class="w-3 h-3 rounded-full bg-[#34A853]"></div> In Progress</div>
                                        <div><span class="font-bold text-gray-800">28</span> <span class="text-gray-400 text-xs ml-1">(44%)</span></div>
                                    </div>
                                    <div class="flex justify-between items-center text-sm">
                                        <div class="flex items-center gap-2 text-gray-700 font-medium"><div class="w-3 h-3 rounded-full bg-[#FBBC05]"></div> Pending</div>
                                        <div><span class="font-bold text-gray-800">12</span> <span class="text-gray-400 text-xs ml-1">(19%)</span></div>
                                    </div>
                                    <div class="flex justify-between items-center text-sm">
                                        <div class="flex items-center gap-2 text-gray-700 font-medium"><div class="w-3 h-3 rounded-full bg-[#EA4335]"></div> Stalled</div>
                                        <div><span class="font-bold text-gray-800">6</span> <span class="text-gray-400 text-xs ml-1">(9%)</span></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Bar/Line Chart (CSS representation) -->
                        <div class="lg:col-span-8 bg-white rounded-2xl p-6 shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-gray-100 cursor-pointer hover:shadow-lg transition-all flex flex-col">
                            <h3 class="text-lg font-bold text-gray-800 mb-4">รายละเอียดผลงานรายเดือน ค.ศ. 2024</h3>
                            
                            <div class="flex flex-wrap gap-4 mb-8">
                                <div class="flex items-center gap-2 text-xs text-gray-600"><div class="w-2.5 h-2.5 rounded-full bg-[#4285F4]"></div> Development</div>
                                <div class="flex items-center gap-2 text-xs text-gray-600"><div class="w-2.5 h-2.5 rounded-full bg-[#8E24AA]"></div> Marketing</div>
                                <div class="flex items-center gap-2 text-xs text-gray-600"><div class="w-2.5 h-2.5 rounded-full bg-[#FFCA28]"></div> Website</div>
                                <div class="flex items-center gap-2 text-xs text-gray-600"><div class="w-2.5 h-2.5 rounded-full bg-[#FF9800]"></div> Events</div>
                                <div class="flex items-center gap-2 text-xs text-gray-600"><div class="w-2.5 h-2.5 rounded-full bg-[#00BFA5]"></div> Internal</div>
                                <div class="flex items-center gap-2 text-xs text-gray-600"><div class="w-2.5 h-2.5 rounded-full bg-[#EF5350]"></div> Ads</div>
                            </div>

                            <div class="flex-1 relative flex items-end justify-between px-2 min-h-[220px]">
                                <!-- Grid Lines -->
                                <div class="absolute inset-0 flex flex-col justify-between pointer-events-none">
                                    <div class="w-full border-t border-gray-100 h-0 relative"><span class="absolute -top-2.5 -left-8 text-xs text-gray-400">400</span></div>
                                    <div class="w-full border-t border-gray-100 h-0 relative"><span class="absolute -top-2.5 -left-8 text-xs text-gray-400">300</span></div>
                                    <div class="w-full border-t border-gray-100 h-0 relative"><span class="absolute -top-2.5 -left-8 text-xs text-gray-400">200</span></div>
                                    <div class="w-full border-t border-gray-100 h-0 relative"><span class="absolute -top-2.5 -left-8 text-xs text-gray-400">100</span></div>
                                    <div class="w-full border-t border-gray-200 h-0 relative"></div>
                                </div>
                                
                                <!-- Mock Line Graph SVG overlay -->
                                <svg class="absolute inset-0 w-full h-full pointer-events-none drop-shadow-md" preserveAspectRatio="none" viewBox="0 0 100 100">
                                    <polyline points="4,60 12,85 20,87 29,95 37,20 45,10 54,40 62,38 71,45 79,25 87,48 95,80" fill="none" stroke="#E65100" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
                                </svg>

                                <!-- Bars -->
                                <div class="w-8 h-[25%] flex flex-col justify-end group"><div class="w-full h-[40%] bg-[#4285F4] rounded-t-sm group-hover:opacity-80 transition-opacity"></div><div class="text-center text-[10px] text-gray-400 mt-2 absolute -bottom-5">Jan</div></div>
                                <div class="w-8 h-[20%] flex flex-col justify-end group"><div class="w-full h-[30%] bg-[#FFCA28] rounded-t-sm group-hover:opacity-80 transition-opacity"></div><div class="w-full h-[50%] bg-[#4285F4]"></div><div class="text-center text-[10px] text-gray-400 mt-2 absolute -bottom-5">Feb</div></div>
                                <div class="w-8 h-[12%] flex flex-col justify-end group"><div class="w-full h-[60%] bg-[#8E24AA] rounded-t-sm group-hover:opacity-80 transition-opacity"></div><div class="w-full h-[40%] bg-[#4285F4]"></div><div class="text-center text-[10px] text-gray-400 mt-2 absolute -bottom-5">Mar</div></div>
                                <div class="w-8 h-[5%] flex flex-col justify-end group"><div class="w-full h-[100%] bg-[#4285F4] rounded-t-sm group-hover:opacity-80 transition-opacity"></div><div class="text-center text-[10px] text-gray-400 mt-2 absolute -bottom-5">Apr</div></div>
                                <div class="w-8 h-[30%] flex flex-col justify-end group"><div class="w-full h-[20%] bg-[#00BFA5] rounded-t-sm group-hover:opacity-80 transition-opacity"></div><div class="w-full h-[30%] bg-[#FFCA28]"></div><div class="w-full h-[50%] bg-[#4285F4]"></div><div class="text-center text-[10px] text-gray-400 mt-2 absolute -bottom-5">May</div></div>
                                <div class="w-8 h-[90%] flex flex-col justify-end group"><div class="w-full h-[15%] bg-[#00BFA5] rounded-t-sm group-hover:opacity-80 transition-opacity"></div><div class="w-full h-[15%] bg-[#8E24AA]"></div><div class="w-full h-[20%] bg-[#FFCA28]"></div><div class="w-full h-[50%] bg-[#4285F4]"></div><div class="text-center text-[10px] text-gray-400 mt-2 absolute -bottom-5">Jun</div></div>
                                <div class="w-8 h-[75%] flex flex-col justify-end group"><div class="w-full h-[20%] bg-[#00BFA5] rounded-t-sm group-hover:opacity-80 transition-opacity"></div><div class="w-full h-[20%] bg-[#8E24AA]"></div><div class="w-full h-[20%] bg-[#FF9800]"></div><div class="w-full h-[40%] bg-[#4285F4]"></div><div class="text-center text-[10px] text-gray-400 mt-2 absolute -bottom-5">Jul</div></div>
                                <div class="w-8 h-[80%] flex flex-col justify-end group"><div class="w-full h-[10%] bg-[#EF5350] rounded-t-sm group-hover:opacity-80 transition-opacity"></div><div class="w-full h-[20%] bg-[#00BFA5]"></div><div class="w-full h-[15%] bg-[#8E24AA]"></div><div class="w-full h-[15%] bg-[#FFCA28]"></div><div class="w-full h-[40%] bg-[#4285F4]"></div><div class="text-center text-[10px] text-gray-400 mt-2 absolute -bottom-5">Aug</div></div>
                                <div class="w-8 h-[70%] flex flex-col justify-end group"><div class="w-full h-[15%] bg-[#EF5350] rounded-t-sm group-hover:opacity-80 transition-opacity"></div><div class="w-full h-[15%] bg-[#00BFA5]"></div><div class="w-full h-[25%] bg-[#FF9800]"></div><div class="w-full h-[45%] bg-[#4285F4]"></div><div class="text-center text-[10px] text-gray-400 mt-2 absolute -bottom-5">Sep</div></div>
                                <div class="w-8 h-[80%] flex flex-col justify-end group"><div class="w-full h-[20%] bg-[#00BFA5] rounded-t-sm group-hover:opacity-80 transition-opacity"></div><div class="w-full h-[20%] bg-[#FFCA28]"></div><div class="w-full h-[20%] bg-[#FF9800]"></div><div class="w-full h-[40%] bg-[#4285F4]"></div><div class="text-center text-[10px] text-gray-400 mt-2 absolute -bottom-5">Oct</div></div>
                                <div class="w-8 h-[40%] flex flex-col justify-end group"><div class="w-full h-[25%] bg-[#00BFA5] rounded-t-sm group-hover:opacity-80 transition-opacity"></div><div class="w-full h-[25%] bg-[#FFCA28]"></div><div class="w-full h-[50%] bg-[#4285F4]"></div><div class="text-center text-[10px] text-gray-400 mt-2 absolute -bottom-5">Nov</div></div>
                                <div class="w-8 h-[20%] flex flex-col justify-end group"><div class="w-full h-[30%] bg-[#FFCA28] rounded-t-sm group-hover:opacity-80 transition-opacity"></div><div class="w-full h-[70%] bg-[#4285F4]"></div><div class="text-center text-[10px] text-gray-400 mt-2 absolute -bottom-5">Dec</div></div>
                            </div>
                        </div>
                    </div>

                    <!-- 4. Bottom Section (Recent Projects) -->
                    <div class="bg-white rounded-2xl p-6 shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-gray-100 mx-2 mb-8">
                        <div class="flex justify-between items-center mb-6">
                            <h3 class="text-lg font-bold text-gray-800">โปรเจกต์ล่าสุด</h3>
                            <button class="text-sm text-blue-600 font-medium hover:underline flex items-center gap-1 transition-colors">
                                ดูทั้งหมด <i class="fa-solid fa-chevron-right text-xs"></i>
                            </button>
                        </div>
                        
                        <div class="flex flex-col space-y-4">
                            <!-- Project 1 -->
                            <div class="flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors border border-transparent hover:border-gray-100">
                                <div class="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-xl shrink-0"><i class="fa-solid fa-code"></i></div>
                                <div class="flex-1 min-w-0">
                                    <h4 class="font-bold text-gray-800 truncate">Open House 2024</h4>
                                    <div class="flex items-center gap-4 mt-1">
                                        <div class="text-xs text-gray-500 font-medium">72%</div>
                                        <div class="text-xs text-gray-400"><i class="fa-regular fa-clock"></i> Due: 30 พ.ค. 2567</div>
                                    </div>
                                </div>
                                <div class="w-full md:w-64 h-6 rounded-full bg-red-100 relative shrink-0 overflow-hidden">
                                    <div class="absolute top-0 left-0 h-full bg-green-500 flex items-center justify-center rounded-full" style="width: 72%;">
                                        <span class="text-[10px] font-bold text-white">72%</span>
                                    </div>
                                    <div class="absolute top-0 right-0 h-full w-[28%] flex items-center justify-center">
                                        <span class="text-[10px] font-bold text-gray-600">28%</span>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Project 2 -->
                            <div class="flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors border border-transparent hover:border-gray-100">
                                <div class="w-12 h-12 rounded-xl bg-teal-100 text-teal-600 flex items-center justify-center text-xl shrink-0"><i class="fa-solid fa-laptop-code"></i></div>
                                <div class="flex-1 min-w-0">
                                    <h4 class="font-bold text-gray-800 truncate">โครงการพัฒนาไอที 2024</h4>
                                    <div class="flex items-center gap-4 mt-1">
                                        <div class="text-xs text-gray-500 font-medium">58%</div>
                                        <div class="text-xs text-gray-400"><i class="fa-regular fa-clock"></i> Due: 20 มิ.ย. 2567</div>
                                    </div>
                                </div>
                                <div class="w-full md:w-64 h-6 rounded-full bg-red-100 relative shrink-0 overflow-hidden">
                                    <div class="absolute top-0 left-0 h-full bg-green-500 flex items-center justify-center rounded-full" style="width: 58%;">
                                        <span class="text-[10px] font-bold text-white">58%</span>
                                    </div>
                                    <div class="absolute top-0 right-0 h-full w-[42%] flex items-center justify-center">
                                        <span class="text-[10px] font-bold text-gray-600">42%</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Project 3 -->
                            <div class="flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors border border-transparent hover:border-gray-100">
                                <div class="w-12 h-12 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center text-xl shrink-0"><i class="fa-solid fa-book-open-reader"></i></div>
                                <div class="flex-1 min-w-0">
                                    <h4 class="font-bold text-gray-800 truncate">โครงการห้องสมุดดิจิทัล</h4>
                                    <div class="flex items-center gap-4 mt-1">
                                        <div class="text-xs text-gray-500 font-medium">35%</div>
                                        <div class="text-xs text-gray-400"><i class="fa-regular fa-clock"></i> Due: 1 ส.ค. 2567</div>
                                    </div>
                                </div>
                                <div class="w-full md:w-64 h-6 rounded-full bg-red-100 relative shrink-0 overflow-hidden">
                                    <div class="absolute top-0 left-0 h-full bg-green-500 flex items-center justify-center rounded-full" style="width: 35%;">
                                        <span class="text-[10px] font-bold text-white">35%</span>
                                    </div>
                                    <div class="absolute top-0 right-0 h-full w-[65%] flex items-center justify-center">
                                        <span class="text-[10px] font-bold text-gray-600">65%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
    `;
    indexHtml = indexHtml.replace(viewSectionRegex, `$&${dashboardHTML}`);
}

fs.writeFileSync(indexHtmlPath, indexHtml);
console.log('Dashboard added to index.html');
