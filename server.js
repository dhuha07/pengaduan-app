require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');

const db = require('./database/db');
const appRoutes = require('./routes/routes');

const app = express();

const FONNTE_TOKEN = process.env.FONNTE_TOKEN || '';

/* ==========================================================================
   1. VIEW ENGINE & MIDDLEWARE CONFIGURATION
   ========================================================================== */
app.set('views', path.join(__dirname, 'resources', 'views'));
app.set('view engine', 'ejs');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets dari folder 'public' secara universal
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// Logging request khusus API
app.use('/api', (req, res, next) => {
    console.log(`[REQUEST API] ${req.method} ${req.originalUrl}`);
    next();
});

/* ==========================================================================
   2. HANDLER WEBHOOK & SEND MESSAGE (FONNTE)
   ========================================================================== */
const handleFonnteWebhook = async (req, res) => {
    try {
        const { sender, name, message } = req.body;
        if (!sender || !message) {
            return res.status(200).json({ status: true, message: 'Payload tidak valid atau diabaikan' });
        }

        const rawPhone = sender.replace(/[^0-9]/g, '');
        const phoneLocal = rawPhone.startsWith('62') ? '0' + rawPhone.slice(2) : rawPhone;
        const phoneIntl = rawPhone.startsWith('0') ? '62' + rawPhone.slice(1) : rawPhone;

        const [reports] = await db.query(
            "SELECT id FROM pengaduan WHERE (nomor_wa = ? OR nomor_wa = ?) AND status_validasi != 'Selesai' ORDER BY id DESC LIMIT 1", 
            [phoneLocal, phoneIntl]
        );

        let idPengaduan = reports.length > 0 ? reports[0].id : null;

        if (!idPengaduan) {
            const [newReport] = await db.query(
                'INSERT INTO pengaduan (nama_pelapor, nomor_wa, kategori_kasus, status_validasi) VALUES (?, ?, ?, ?)',
                [name || `Pelapor WA (${phoneLocal})`, phoneLocal, 'Pengaduan WA', 'Baru']
            );
            idPengaduan = newReport.insertId;
        }

        const [insertedMsg] = await db.query(
            'INSERT INTO pesan_percakapan (id_pengaduan, pengirim, pesan) VALUES (?, "user", ?)',
            [idPengaduan, message]
        );

        return res.status(200).json({ status: true });
    } catch (err) {
        console.error('[WEBHOOK ERROR]', err.message);
        return res.status(500).json({ status: false, message: err.message });
    }
};

const sendMessageHandler = async (req, res) => {
    try {
        const id_pengaduan = req.body.id_pengaduan || req.body.id || req.body.pengaduan_id || req.params.id || req.params.id_pengaduan;
        const pesan = req.body.pesan || req.body.message || req.body.text;

        if (!id_pengaduan || !pesan) {
            return res.status(400).json({ success: false, message: 'ID pengaduan dan pesan wajib diisi.' });
        }

        const parsedId = parseInt(id_pengaduan, 10);
        if (isNaN(parsedId)) {
            return res.status(400).json({ success: false, message: 'ID pengaduan tidak valid.' });
        }

        const [report] = await db.query('SELECT nomor_wa FROM pengaduan WHERE id = ?', [parsedId]);
        if (report.length === 0) {
            return res.status(404).json({ success: false, message: 'Data pengaduan tidak ditemukan.' });
        }

        await db.query(
            'INSERT INTO pesan_percakapan (id_pengaduan, pengirim, pesan) VALUES (?, "admin", ?)',
            [parsedId, pesan]
        );

        let fonnteResult = null;
        if (FONNTE_TOKEN) {
            try {
                const response = await fetch('https://api.fonnte.com/send', {
                    method: 'POST',
                    headers: { 
                        'Authorization': FONNTE_TOKEN, 
                        'Content-Type': 'application/json' 
                    },
                    body: JSON.stringify({ target: report[0].nomor_wa, message: pesan })
                });
                fonnteResult = await response.json();
            } catch (apiErr) {
                console.error('[FONNTE NETWORK ERROR]', apiErr.message);
            }
        } else {
            console.warn('[WARNING] FONNTE_TOKEN belum diatur di .env. Pesan tersimpan di DB tetapi tidak dikirim ke WA.');
        }

        return res.json({ success: true, message: 'Pesan berhasil dikirim.', fonnte: fonnteResult });
    } catch (err) {
        console.error('[SEND MESSAGE ERROR]', err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
};

/* ==========================================================================
   3. ROUTING & API ENDPOINTS
   ========================================================================== */
app.post('/whatsapp-webhook', handleFonnteWebhook);
app.post('/api/whatsapp/webhook', handleFonnteWebhook);
app.post('/api/percakapan', sendMessageHandler);
app.post('/api/percakapan/:id_pengaduan', sendMessageHandler);
app.post('/api/kirim-pesan', sendMessageHandler);
app.post('/api/send-message', sendMessageHandler);

// Pasang aplikasi router utama
app.use('/', appRoutes);

/* ==========================================================================
   4. FALLBACK & ERROR HANDLING
   ========================================================================== */
// Fallback API 404
app.use('/api', (req, res) => {
    return res.status(404).json({ 
        success: false, 
        message: `Endpoint API (${req.method} ${req.originalUrl}) tidak ditemukan.` 
    });
});

// Fallback Render View 404
app.use(async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM pengaduan ORDER BY id DESC');
        return res.status(404).render('dashboard', { dataPengaduan: rows || [] });
    } catch (err) {
        return res.status(404).render('dashboard', { dataPengaduan: [] });
    }
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('[UNHANDLED ERROR]', err);
    if (res.headersSent) {
        return next(err);
    }
    if (req.originalUrl && req.originalUrl.startsWith('/api')) {
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
    return res.status(500).render('dashboard', { dataPengaduan: [] });
});

/* ==========================================================================
   5. LISTEN / EXPORT FOR VERCEL
   ========================================================================== */
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server lokal berjalan pada http://localhost:${PORT}`);
    });
}

module.exports = app;