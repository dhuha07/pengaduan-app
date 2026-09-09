let chats = {};
let activeChatId = null;

// Cek Sesi Petugas Saat Halaman Dimuat
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');

    // Proteksi Halaman: Jika bukan petugas/admin, redirect ke login
    if (!token || (role !== 'admin' && role !== 'petugas')) {
        alert('Akses terbatas hanya untuk petugas.');
        window.location.href = 'index.html';
        return;
    }

    // Inisialisasi Event Listener
    setupEventListeners();
    
    // Load Data Percakapan
    await loadChatHistory();
});

// Setup Event Listener (Sidebar, Enter Key, Search)
function setupEventListeners() {
    // Sidebar Toggle
    const sidebar = document.getElementById("sidebar");
    const toggleSidebar = document.getElementById("toggleSidebar");
    
    if (localStorage.getItem("sidebar") === "collapsed") {
        sidebar?.classList.add("collapsed");
    }

    toggleSidebar?.addEventListener("click", () => {
        sidebar?.classList.toggle("collapsed");
        localStorage.setItem("sidebar", sidebar?.classList.contains("collapsed") ? "collapsed" : "open");
    });

    // Send Message on Enter Key
    document.getElementById("messageInput")?.addEventListener("keypress", (e) => {
        if (e.key === "Enter") sendMessage();
    });

    // Search Input Real-time
    document.getElementById("searchInput")?.addEventListener("keyup", filterChats);
}

// Fetch Data Percakapan dari Backend MySQL
async function loadChatHistory() {
    try {
        const response = await fetch('/api/percakapan', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const result = await response.json();

        if (result.success) {
            formatChatData(result.data);
            renderChatList();
            
            // Auto open first chat if available
            const firstKey = Object.keys(chats)[0];
            if (firstKey) openChat(firstKey);
        }
    } catch (error) {
        console.error('Gagal memuat percakapan:', error);
    }
}

// Grouping Data Flat MySQL ke Struktur Object Chat
function formatChatData(rawRows) {
    chats = {};
    rawRows.forEach(row => {
        if (!chats[row.id_pengaduan]) {
            chats[row.id_pengaduan] = {
                nama: row.nama_pelapor || 'Anonim',
                noLaporan: `#LP${row.id_pengaduan}`,
                kasus: row.kategori_kasus || '-',
                status: (row.status_validasi || 'baru').toLowerCase(),
                phone: row.nomor_wa,
                pesan: []
            };
        }
        if (row.pesan) {
            chats[row.id_pengaduan].pesan.push({
                type: row.pengirim, // 'user' atau 'admin'
                text: row.pesan,
                time: new Date(row.created_at)
            });
        }
    });
}

// RENDER CHAT LIST
function renderChatList() {
    const listContainer = document.getElementById("chatList");
    if (!listContainer) return;
    listContainer.innerHTML = "";

    Object.keys(chats).forEach(key => {
        const item = chats[key];
        const lastMsgObj = item.pesan[item.pesan.length - 1];
        const lastMessage = lastMsgObj ? lastMsgObj.text : "Belum ada pesan";
        const activeClass = key == activeChatId ? "active" : "";

        listContainer.innerHTML += `
            <div class="chat-item ${activeClass}" 
                 id="item-${key}"
                 data-name="${item.nama}" 
                 data-laporan="${item.noLaporan}" 
                 data-status="${item.status}" 
                 data-kasus="${item.kasus}" 
                 onclick="openChat('${key}')">
                <div class="chat-top">
                    <div class="chat-user">
                        <div class="avatar"><i class="fa-regular fa-user"></i></div>
                        <div class="chat-info">
                            <h3>${item.nama} <span class="badge-status status-${item.status}">${item.status}</span></h3>
                            <span>${item.noLaporan}</span>
                            <div class="chat-preview">${lastMessage}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    filterChats();
}

// BUKA CHAT AKTIF
function openChat(chatId) {
    activeChatId = chatId;
    const data = chats[chatId];
    if (!data) return;

    document.getElementById("chatName").innerHTML = `${data.nama} <span class="badge-status status-${data.status}">${data.status}</span>`;
    document.getElementById("chatCase").innerText = data.kasus;

    document.querySelectorAll(".chat-item").forEach(item => item.classList.remove("active"));
    const selectedItem = document.getElementById(`item-${chatId}`);
    if (selectedItem) selectedItem.classList.add("active");

    if (data.phone) {
        const cleanPhone = data.phone.replace(/[^0-9]/g, '');
        const formattedPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;
        const waText = encodeURIComponent(`Halo ${data.nama}, kami dari DPMP4KB Kota Magelang terkait laporan ${data.noLaporan}.`);
        document.getElementById("waBtn").href = `https://wa.me/${formattedPhone}?text=${waText}`;
    }

    renderMessages();
}

// RENDER PESAN
function renderMessages() {
    const body = document.getElementById("chatBody");
    if (!body) return;
    body.innerHTML = "";

    if (!activeChatId || !chats[activeChatId]) return;

    chats[activeChatId].pesan.forEach(msg => {
        const timeString = new Date(msg.time).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
        body.innerHTML += `
            <div class="message ${msg.type}">
                ${msg.text}
                <div class="message-time">${timeString}</div>
            </div>
        `;
    });

    body.scrollTop = body.scrollHeight;
}

// KIRIM PESAN DARI PETUGAS KE DATABASE
async function sendMessage() {
    const input = document.getElementById("messageInput");
    const text = input.value.trim();

    if (!text || !activeChatId) return;

    try {
        const response = await fetch('/api/percakapan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                id_pengaduan: activeChatId,
                pesan: text
            })
        });

        const result = await response.json();
        if (result.success) {
            chats[activeChatId].pesan.push({
                type: "admin",
                text: text,
                time: new Date()
            });
            input.value = "";
            renderChatList();
            renderMessages();
        } else {
            alert("Gagal mengirim pesan.");
        }
    } catch (error) {
        console.error("Error sending message:", error);
    }
}

// FILTER CHATS & SEARCH
function filterChats() {
    const searchKeyword = (document.getElementById("searchInput")?.value || "").toLowerCase().trim();
    const statusFilter = document.getElementById("filterStatus")?.value || "";
    const kasusFilter = document.getElementById("filterKasus")?.value || "";

    document.querySelectorAll(".chat-item").forEach(item => {
        const nama = (item.dataset.name || "").toLowerCase();
        const laporan = (item.dataset.laporan || "").toLowerCase();
        const status = item.dataset.status;
        const kasus = item.dataset.kasus;

        const matchSearch = nama.includes(searchKeyword) || laporan.includes(searchKeyword);
        const matchStatus = !statusFilter || status === statusFilter;
        const matchKasus = !kasusFilter || kasus === kasusFilter;

        if (matchSearch && matchStatus && matchKasus) {
            item.style.display = "";
        } else {
            item.style.display = "none";
        }
    });
}

// EXPORT TO PDF
function exportToPDF() {
    if (!activeChatId || !chats[activeChatId]) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const data = chats[activeChatId];
    
    doc.setFont("helvetica", "bold");
    doc.text(`ARSIP TRANSKRIP PERCAKAPAN - DPMP4KB`, 14, 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`No Laporan: ${data.noLaporan} | Pelapor: ${data.nama} | Kasus: ${data.kasus}`, 14, 28);
    doc.line(14, 32, 196, 32);
    
    let posY = 42;
    data.pesan.forEach(msg => {
        const timeStr = new Date(msg.time).toLocaleTimeString("id-ID", {hour: '2-digit', minute:'2-digit'});
        const sender = msg.type === "admin" ? "Petugas Admin" : data.nama;
        
        doc.setFont("helvetica", "bold");
        doc.text(`[${timeStr}] ${sender}:`, 14, posY);
        doc.setFont("helvetica", "normal");
        
        let splitText = doc.splitTextToSize(msg.text, 170);
        doc.text(splitText, 20, posY + 6);
        posY += (splitText.length * 6) + 10;
    });
    
    doc.save(`Transkrip_${data.noLaporan}.pdf`);
}

// PRINT BERITA ACARA
function printBeritaAcara() {
    if (!activeChatId || !chats[activeChatId]) return;
    const data = chats[activeChatId];
    
    document.getElementById("bapNo").innerText = `BA-${data.noLaporan.replace('#', '')}/${new Date().getFullYear()}`;
    document.getElementById("bapNama").innerText = data.nama;
    document.getElementById("bapKasus").innerText = data.kasus;
    document.getElementById("bapStatus").innerText = data.status.toUpperCase();
    document.getElementById("bapTanggal").innerText = new Date().toLocaleDateString("id-ID", { dateStyle: "long" });
    
    let logHTML = "";
    data.pesan.forEach(msg => {
        const timeStr = new Date(msg.time).toLocaleTimeString("id-ID", {hour: '2-digit', minute:'2-digit'});
        const sender = msg.type === "admin" ? "PETUGAS" : "PELAPOR";
        logHTML += `<p><strong>[${timeStr}] ${sender}:</strong> ${msg.text}</p>`;
    });
    document.getElementById("bapLog").innerHTML = logHTML;
    
    window.print();
}