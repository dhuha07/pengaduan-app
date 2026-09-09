const express = require('express');
const router = express.Router();
const db = require('../database/db');

/* ==========================================================================
   MIDDLEWARE: Tangkap & Alihkan request berakhiran .html secara otomatis
   ========================================================================== */
router.use((req, res, next) => {
    if (req.path.endsWith('.html')) {
        const cleanPath = req.path.slice(0, -5);
        // Pertahankan query string jika ada
        const queryString = req.url.slice(req.path.length);
        return res.redirect(301, cleanPath + queryString);
    }
    next();
});

/* ==========================================================================
   PAGE ROUTES (Melayani file .ejs di resources/views/)
   ========================================================================== */

// Dashboard
router.get(['/', '/dashboard', '/index'], async (req, res, next) => {
    try {
        const [rows] = await db.query('SELECT * FROM pengaduan ORDER BY id DESC');
        res.render('dashboard', { dataPengaduan: rows || [] });
    } catch (err) {
        console.error('[ROUTE ERROR /dashboard]:', err);
        next(err); // Diteruskan ke Error Handler Express
    }
});

// Login
router.get('/login', (req, res) => {
    res.render('login');
});

// Daftar Pengaduan
router.get(['/pengaduan', '/daftar-pengaduan'], async (req, res, next) => {
    try {
        const [rows] = await db.query('SELECT * FROM pengaduan ORDER BY id DESC');
        res.render('daftar-pengaduan', { dataPengaduan: rows || [] });
    } catch (err) {
        console.error('[ROUTE ERROR /pengaduan]:', err);
        next(err);
    }
});

// Detail Pengaduan
router.get('/detail-pengaduan/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT * FROM pengaduan WHERE id = ?', [id]);
        
        if (!rows.length) {
            return res.status(404).render('404', { message: 'Pengaduan tidak ditemukan' });
        }

        res.render('detail-pengaduan', { detail: rows[0] });
    } catch (err) {
        console.error('[ROUTE ERROR /detail-pengaduan]:', err);
        next(err);
    }
});

// Redirect untuk /detail-pengaduan tanpa ID
router.get('/detail-pengaduan', (req, res) => {
    res.redirect('/daftar-pengaduan');
});

// Laporan
router.get('/laporan', async (req, res, next) => {
    try {
        const [rows] = await db.query('SELECT * FROM pengaduan ORDER BY id DESC');
        res.render('laporan', { dataLaporan: rows || [] });
    } catch (err) {
        console.error('[ROUTE ERROR /laporan]:', err);
        next(err);
    }
});

// Pengguna (Strict MySQL Compatible)
router.get('/pengguna', async (req, res, next) => {
    try {
        const [rows] = await db.query(
            'SELECT nomor_wa, MAX(nama_pelapor) AS nama_pelapor, MAX(created_at) AS created_at FROM pengaduan GROUP BY nomor_wa'
        );
        res.render('pengguna', { dataPengguna: rows || [] });
    } catch (err) {
        console.error('[ROUTE ERROR /pengguna]:', err);
        next(err);
    }
});

// Tambah Pengguna
router.get('/tambah-pengguna', (req, res) => {
    res.render('tambah-pengguna');
});

// Update Status (FIX: Query data laporan secara SSR agar EJS menerima objek `data`)
router.get('/update-status/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT * FROM pengaduan WHERE id = ?', [id]);

        if (!rows.length) {
            return res.status(404).render('404', { message: 'Data laporan tidak ditemukan' });
        }

        res.render('update-status', { data: rows[0] });
    } catch (err) {
        console.error('[ROUTE ERROR /update-status]:', err);
        next(err);
    }
});

router.get('/update-status', (req, res) => {
    res.redirect('/daftar-pengaduan');
});

// Page Sukses Update Status
router.get('/sukses-update-status', (req, res) => {
    res.render('Page-sukses-update-status');
});

// Riwayat Percakapan
router.get(['/percakapan', '/riwayat-percakapan'], async (req, res, next) => {
    try {
        const [rows] = await db.query('SELECT * FROM pesan_percakapan ORDER BY created_at ASC');
        res.render('riwayat-percakapan', { dataPercakapan: rows || [] });
    } catch (err) {
        console.error('[ROUTE ERROR /percakapan]:', err);
        next(err);
    }
});

/* ==========================================================================
   API ENDPOINTS (RESTful API)
   ========================================================================== */

// Fetch All Pengaduan
router.get('/api/pengaduan', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM pengaduan ORDER BY id DESC');
        res.json({ success: true, data: rows || [] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server database.' });
    }
});

// Fetch Single Pengaduan Detail By ID (FIX: Ditambahkan untuk pencarian via AJAX)
router.get('/api/pengaduan/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT * FROM pengaduan WHERE id = ?', [id]);

        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'Data pengaduan tidak ditemukan.' });
        }

        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server database.' });
    }
});

// Update Status Pengaduan (FIX: Diperlukan oleh AJAX Request Frontend)
router.put('/api/pengaduan/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status_validasi, tingkat_urgensi, catatan_admin } = req.body;

        // Validasi Payload
        if (!status_validasi || !tingkat_urgensi) {
            return res.status(400).json({ 
                success: false, 
                message: 'Status validasi dan tingkat urgensi wajib diisi.' 
            });
        }

        const [result] = await db.query(
            `UPDATE pengaduan 
             SET status_validasi = ?, tingkat_urgensi = ?, catatan_admin = ?, updated_at = NOW() 
             WHERE id = ?`,
            [status_validasi, tingkat_urgensi, catatan_admin || null, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan atau gagal diperbarui.' });
        }

        res.json({ success: true, message: 'Status laporan berhasil diperbarui.' });
    } catch (err) {
        console.error('[API ERROR PUT /api/pengaduan/:id]:', err);
        res.status(500).json({ success: false, message: 'Gagal memperbarui data pada database.' });
    }
});

// Fetch Detail Percakapan By ID Pengaduan
router.get('/api/percakapan/:id_pengaduan', async (req, res) => {
    try {
        const { id_pengaduan } = req.params;
        const [rows] = await db.query(
            'SELECT * FROM pesan_percakapan WHERE id_pengaduan = ? ORDER BY created_at ASC',
            [id_pengaduan]
        );
        res.json({ success: true, data: rows || [] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Gagal mengambil data percakapan.' });
    }
});

module.exports = router;