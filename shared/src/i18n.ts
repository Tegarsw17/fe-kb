// Translations. Bahasa Indonesia is the base language; English is optional.
// Usage: t('nav.dashboard')  or  t('tree.count', { n: 12 })
// To add a word: add the key to both `id` and `en` below.

import type { Lang } from './types';

const id = {
  'app.name': 'Kebun Durian',
  'app.tagline': 'Catatan kebun, rapi dan menyenangkan',

  'nav.dashboard': 'Beranda', 'nav.garden': 'Kebun 3D', 'nav.trees': 'Pohon', 'nav.schedules': 'Jadwal',
  'nav.tasks': 'Tugas', 'nav.reports': 'Laporan Harian', 'nav.records': 'Catatan Pohon', 'nav.harvest': 'Panen',
  'nav.stock': 'Stok', 'nav.finance': 'Keuangan', 'nav.weather': 'Cuaca', 'nav.users': 'Pengguna',
  'nav.settings': 'Pengaturan', 'nav.more': 'Lainnya',

  'common.add': 'Tambah', 'common.edit': 'Ubah', 'common.delete': 'Hapus', 'common.save': 'Simpan',
  'common.cancel': 'Batal', 'common.close': 'Tutup', 'common.search': 'Cari…', 'common.all': 'Semua',
  'common.none': '–', 'common.site': 'Kebun', 'common.allSites': 'Semua kebun', 'common.date': 'Tanggal',
  'common.note': 'Catatan', 'common.notes': 'Catatan', 'common.photos': 'Foto', 'common.addPhoto': 'Tambah foto',
  'common.name': 'Nama', 'common.total': 'Total', 'common.empty': 'Belum ada data.', 'common.loading': 'Memuat…',
  'common.confirmDelete': 'Yakin hapus data ini?', 'common.saved': 'Tersimpan', 'common.saving': 'Menyimpan…', 'common.deleted': 'Terhapus',
  'common.error': 'Terjadi kesalahan', 'common.yes': 'Ya', 'common.no': 'Tidak', 'common.status': 'Status',
  'common.seeAll': 'Lihat semua', 'common.by': 'oleh', 'common.year': 'Tahun', 'common.month': 'Bulan',
  'common.type': 'Jenis', 'common.amount': 'Jumlah', 'common.active': 'Aktif', 'common.inactive': 'Nonaktif',
  'common.optional': 'opsional', 'common.required': 'wajib diisi', 'common.today': 'Hari ini',
  'common.unassigned': 'Siapa saja', 'common.wholeSite': 'Seluruh kebun', 'common.demo': 'Mode demo',
  'common.demoHint': 'Data contoh, tersimpan di browser ini saja.', 'common.resetDemo': 'Reset data demo',
  'common.logout': 'Keluar', 'common.language': 'Bahasa', 'common.export': 'Ekspor CSV',
  'common.theme': 'Tema', 'theme.system': 'Ikuti perangkat', 'theme.light': 'Terang', 'theme.dark': 'Gelap',

  'auth.login': 'Masuk', 'auth.username': 'Username atau email', 'auth.password': 'Kata sandi',
  'auth.failed': 'Username atau kata sandi salah', 'auth.tryDemo': 'Coba mode demo',
  'auth.firstUser': 'Akun pertama otomatis menjadi Pemilik.',

  'role.owner': 'Pemilik', 'role.worker': 'Pekerja',

  'dash.hello': 'Selamat {part}, {name}!', 'dash.morning': 'pagi', 'dash.noon': 'siang', 'dash.afternoon': 'sore',
  'dash.evening': 'malam', 'dash.todo': 'Yang perlu dikerjakan', 'dash.overdue': 'Terlambat',
  'dash.dueToday': 'Hari ini', 'dash.dueSoon': '7 hari ke depan', 'dash.lowStock': 'Stok menipis',
  'dash.allStocked': 'Semua stok aman 👍', 'dash.upcomingHarvest': 'Perkiraan panen', 'dash.noHarvest': 'Belum ada pohon berbuah.',
  'dash.latestReports': 'Laporan terbaru', 'dash.treeHealth': 'Kesehatan pohon', 'dash.flowering': 'Berbunga',
  'dash.fruiting': 'Berbuah', 'dash.ready': 'Siap panen', 'dash.monthIncome': 'Pemasukan bulan ini',
  'dash.monthExpense': 'Pengeluaran bulan ini', 'dash.monthHarvest': 'Panen bulan ini', 'dash.trees': 'Pohon',
  'dash.openTasks': 'Tugas terbuka', 'dash.nothingDue': 'Tidak ada jadwal mendesak. Santai dulu ☕',
  'dash.markDone': 'Catat selesai', 'dash.openGarden': 'Buka kebun 3D',

  'garden.reset': 'Atur ulang tampilan', 'garden.zoomIn': 'Perbesar', 'garden.zoomOut': 'Perkecil', 'garden.mode3d': '3D', 'garden.mode2d': '2D (ringan)',
  'garden.legend': 'Keterangan', 'garden.hint': 'Geser untuk memutar · cubit/scroll untuk zoom · klik pohon untuk detail',
  'garden.hint2d': 'Cubit/scroll atau tombol +/− untuk zoom · geser untuk memindah peta · klik pohon untuk detail',
  'garden.needsWater': 'Perlu disiram', 'garden.needsCare': 'Jadwal terlambat', 'garden.sick': 'Sakit / perlu dicek',
  'garden.ready': 'Siap panen', 'garden.flowering': 'Berbunga', 'garden.fruiting': 'Berbuah',
  'garden.effects': 'Efek', 'garden.time': 'Waktu', 'garden.timeNow': 'Sekarang', 'garden.weatherAuto': 'Cuaca asli',
  'garden.emptySite': 'Belum ada pohon di kebun ini. Tambahkan di menu Pohon.', 'garden.noWebgl': 'Perangkat ini tidak mendukung 3D. Menampilkan peta 2D.',
  'garden.loading3d': 'Menyiapkan kebun 3D…', 'garden.quality': 'Kualitas grafis', 'garden.qLow': 'Hemat baterai', 'garden.qHigh': 'Grafis tinggi', 'garden.loadFailed': 'Gagal memuat 3D. Menampilkan peta 2D.',

  'tree.name': 'Nama pohon', 'tree.variety': 'Varietas', 'tree.row': 'Baris', 'tree.col': 'Kolom',
  'tree.position': 'Posisi', 'tree.plantedOn': 'Tanggal tanam', 'tree.age': 'Umur', 'tree.phase': 'Fase',
  'tree.health': 'Kesehatan', 'tree.add': 'Tambah pohon', 'tree.bulk': 'Tambah banyak', 'tree.history': 'Riwayat',
  'tree.nextCare': 'Jadwal berikutnya', 'tree.expectedHarvest': 'Perkiraan panen', 'tree.totalHarvest': 'Total panen',
  'page.range': '{from}–{to} dari {n}', 'page.perPage': '{n} / halaman', 'page.size': 'Baris per halaman', 'page.page': 'Halaman',
  'page.of': 'Hal. {p} dari {n}', 'page.prev': 'Halaman sebelumnya', 'page.next': 'Halaman berikutnya',
  'tree.count': '{n} pohon', 'tree.nameTaken': 'Nama sudah dipakai di kebun ini', 'tree.spotTaken': 'Posisi sudah terisi',
  'tree.bulkHelp': 'Isi otomatis grid: pohon diberi nama {code}-1, {code}-2, … di posisi kosong.',
  'tree.bulkCount': 'Jumlah pohon', 'tree.bulkStart': 'Nomor awal', 'tree.youngGroup': 'Muda (1–2 th)',
  'tree.matureGroup': 'Dewasa (5+ th)', 'tree.find': 'Cari pohon (mis. DH-12)', 'tree.recordEvent': 'Catat kejadian',
  'tree.problems': 'Masalah aktif',

  'phase.vegetative': 'Tumbuh', 'phase.flowering': 'Berbunga', 'phase.fruiting': 'Berbuah', 'phase.ready': 'Siap panen',
  'health.healthy': 'Sehat', 'health.watch': 'Perlu dipantau', 'health.sick': 'Sakit', 'health.dead': 'Mati',
  'stage.0': 'Bibit', 'stage.1': 'Muda', 'stage.2': 'Remaja', 'stage.3': 'Dewasa',

  'sched.title': 'Nama jadwal', 'sched.kind': 'Jenis kegiatan', 'sched.every': 'Ulangi tiap', 'sched.days': 'hari',
  'sched.nextDue': 'Jatuh tempo', 'sched.supply': 'Bahan dipakai', 'sched.dose': 'Dosis per pohon',
  'sched.target': 'Untuk', 'sched.assigned': 'Petugas', 'sched.add': 'Tambah jadwal', 'sched.done': 'Catat selesai',
  'sched.estimate': 'Perkiraan pemakaian: {qty}', 'sched.lastDone': 'Terakhir dikerjakan', 'sched.never': 'Belum pernah',
  'sched.history': 'Sudah dikerjakan', 'sched.everyN': 'tiap {n} hari',

  'kind.fertilizing': 'Pemupukan', 'kind.spraying': 'Penyemprotan', 'kind.watering': 'Penyiraman',
  'kind.pruning': 'Pemangkasan', 'kind.weeding': 'Penyiangan', 'kind.other': 'Lainnya',

  'act.log': 'Catat kegiatan', 'act.qtyUsed': 'Jumlah bahan dipakai', 'act.doneOn': 'Tanggal dikerjakan',
  'act.stockWillDrop': 'Stok akan berkurang otomatis.', 'act.fromSchedule': 'Dari jadwal',

  'task.title': 'Judul tugas', 'task.desc': 'Keterangan', 'task.assignee': 'Untuk', 'task.due': 'Batas waktu',
  'task.add': 'Tambah tugas', 'task.todo': 'Belum', 'task.done': 'Selesai', 'task.complete': 'Tandai selesai',
  'task.doneNote': 'Catatan penyelesaian', 'task.doneBy': 'Diselesaikan oleh', 'task.mine': 'Tugas saya',

  'report.add': 'Buat laporan', 'report.workDone': 'Pekerjaan hari ini', 'report.issues': 'Masalah / temuan',
  'report.author': 'Pelapor', 'report.placeholderWork': 'mis. Pupuk NPK 24 pohon blok utara, siangi gulma…',
  'report.placeholderIssues': 'mis. Daun MK-7 menguning, ada ulat di BW-3…', 'report.sent': 'Laporan terkirim. Terima kasih!',
  'report.todayDone': 'Laporan hari ini sudah dikirim',

  'event.kind': 'Jenis catatan', 'event.flowering': 'Mulai berbunga', 'event.fruit_set': 'Buah jadi (pentil)',
  'event.pest': 'Hama', 'event.disease': 'Penyakit', 'event.treatment': 'Penanganan', 'event.note': 'Catatan',
  'event.severity': 'Tingkat', 'event.count': 'Jumlah buah', 'event.titleLabel': 'Nama hama / penyakit',
  'event.resolved': 'Sudah teratasi', 'event.markResolved': 'Tandai teratasi', 'event.add': 'Catat',
  'sev.low': 'Ringan', 'sev.medium': 'Sedang', 'sev.high': 'Berat',

  'harvest.add': 'Catat panen', 'harvest.fruits': 'Jumlah buah', 'harvest.weight': 'Berat (kg)', 'harvest.grade': 'Grade',
  'harvest.perTree': 'Panen per pohon', 'harvest.perSite': 'Panen per kebun', 'harvest.avgFruit': 'Rata-rata per buah',
  'harvest.thisYear': 'Panen tahun ini', 'harvest.topTrees': 'Pohon paling produktif', 'harvest.markReady': 'Tandai berbuah lagi / selesai',

  'stock.add': 'Tambah bahan', 'stock.category': 'Kategori', 'stock.unit': 'Satuan', 'stock.current': 'Stok',
  'stock.min': 'Batas minimum', 'stock.price': 'Harga per satuan', 'stock.buy': 'Beli / tambah stok',
  'stock.adjust': 'Koreksi stok', 'stock.movements': 'Riwayat stok', 'stock.low': 'Menipis', 'stock.ok': 'Aman',
  'stock.qty': 'Jumlah', 'stock.recordExpense': 'Catat juga sebagai pengeluaran', 'stock.newStock': 'Stok sebenarnya',
  'reason.purchase': 'Pembelian', 'reason.usage': 'Pemakaian', 'reason.adjust': 'Koreksi',
  'cat.fertilizer': 'Pupuk', 'cat.pesticide': 'Pestisida', 'cat.fungicide': 'Fungisida', 'cat.other': 'Lainnya',

  'fin.income': 'Pemasukan', 'fin.expense': 'Pengeluaran', 'fin.profit': 'Laba', 'fin.sales': 'Penjualan',
  'fin.expenses': 'Pengeluaran', 'fin.addSale': 'Catat penjualan', 'fin.addExpense': 'Catat pengeluaran',
  'fin.buyer': 'Pembeli', 'fin.pricePerKg': 'Harga per kg', 'fin.perSite': 'Per kebun', 'fin.perMonth': 'Per bulan',
  'fin.shared': 'Umum (semua kebun)', 'fin.category': 'Kategori', 'fin.margin': 'Margin',
  'exp.labor': 'Upah pekerja', 'exp.fertilizer': 'Pupuk', 'exp.pesticide': 'Pestisida/obat', 'exp.fuel': 'BBM',
  'exp.tools': 'Alat', 'exp.transport': 'Transport', 'exp.other': 'Lainnya',

  'weather.now': 'Sekarang', 'weather.humidity': 'Kelembapan', 'weather.wind': 'Angin', 'weather.rain': 'Hujan',
  'weather.forecast': 'Prakiraan 5 hari', 'weather.tips': 'Saran kebun', 'weather.noLocation': 'Atur lokasi kebun di Pengaturan untuk melihat cuaca.',
  'weather.failed': 'Cuaca tidak bisa dimuat.',
  'sensor.title': 'Sensor kebun', 'sensor.live': 'Langsung dari kebun', 'sensor.temp': 'Suhu',
  'sensor.updated': 'Diperbarui {when}', 'sensor.offline': 'Offline', 'sensor.history': 'Riwayat terakhir',
  'sensor.range24h': '24 jam', 'sensor.rangeDays': '{n} hari',
  'sensor.stale': 'Sensor tidak mengirim data sejak {when}. Cek daya dan WiFi alat.', 'sensor.failed': 'Data sensor tidak bisa dimuat.',
  'sky.clear': 'Cerah', 'sky.partly': 'Cerah berawan', 'sky.cloudy': 'Berawan', 'sky.fog': 'Berkabut', 'sky.rain': 'Hujan', 'sky.storm': 'Badai petir',
  'tip.noSpray': 'Kemungkinan hujan tinggi — tunda penyemprotan, obat bisa tercuci.',
  'tip.wind': 'Angin kencang — hindari menyemprot, periksa penyangga pohon muda.',
  'tip.drainage': 'Hujan lebat diperkirakan — cek saluran air, durian rawan busuk akar (Phytophthora).',
  'tip.dry': 'Cuaca kering beberapa hari — perhatikan penyiraman pohon muda.',
  'tip.fungus': 'Lembap dan hangat — waspada jamur, cek batang dan daun.',
  'tip.good': 'Cuaca bagus untuk kegiatan kebun.',

  'user.add': 'Tambah pengguna', 'user.fullName': 'Nama lengkap', 'user.username': 'Username', 'user.password': 'Kata sandi',
  'user.role': 'Peran', 'user.setPassword': 'Ganti sandi', 'user.block': 'Blokir', 'user.unblock': 'Aktifkan',
  'user.help': 'Pekerja masuk ke aplikasi HP dengan username dan sandi ini.', 'user.workerCan': 'Pekerja bisa: lapor harian, tandai tugas, catat pupuk/semprot, hama, panen. Tidak bisa lihat keuangan.',

  'set.sites': 'Kebun', 'set.addSite': 'Tambah kebun', 'set.area': 'Luas (ha)', 'set.lat': 'Lintang (lat)', 'set.lng': 'Bujur (lng)',
  'set.gridRows': 'Jumlah baris', 'set.gridCols': 'Jumlah kolom', 'set.spacing': 'Jarak tanam (m)', 'set.varieties': 'Varietas',
  'set.addVariety': 'Tambah varietas', 'set.code': 'Kode', 'set.color': 'Warna daun (3D)', 'set.daysToRipe': 'Hari sampai matang',
  'set.locHelp': 'Buka Google Maps, tekan lama titik kebun, salin angka koordinatnya.', 'set.useMyLocation': 'Pakai lokasi saya',
  'set.data': 'Data', 'set.gridHelp': '1 ha dengan jarak 8×8 m ≈ 12×12 = 144 titik tanam.',

  'mobile.quick': 'Catat cepat', 'mobile.summary': 'Ringkasan', 'mobile.findTree': 'Cari pohon',
  'mobile.chooseSite': 'Pilih kebun', 'mobile.chooseTree': 'Pilih pohon', 'mobile.camera': 'Kamera', 'mobile.gallery': 'Galeri',
  'mobile.uploading': 'Mengunggah foto…', 'mobile.helloWorker': 'Halo, {name} 👋', 'mobile.yesterday': 'Kemarin',
  'mobile.myTasks': 'Tugas saya', 'mobile.dueWork': 'Jadwal kebun', 'mobile.noTasks': 'Tidak ada tugas. Mantap! 👍', 'mobile.photoHint': 'Tekan lama foto untuk menghapus.', 'mobile.send': 'Kirim', 'mobile.demoLogin': 'Mode demo: masuk dengan pemilik, budi, atau sari (sandi bebas).',
};

export type TKey = keyof typeof id;

const en: Record<TKey, string> = {
  'app.name': 'Durian Farm',
  'app.tagline': 'Farm records, tidy and fun',

  'nav.dashboard': 'Home', 'nav.garden': '3D Garden', 'nav.trees': 'Trees', 'nav.schedules': 'Schedules',
  'nav.tasks': 'Tasks', 'nav.reports': 'Daily Reports', 'nav.records': 'Tree Records', 'nav.harvest': 'Harvest',
  'nav.stock': 'Stock', 'nav.finance': 'Finance', 'nav.weather': 'Weather', 'nav.users': 'Users',
  'nav.settings': 'Settings', 'nav.more': 'More',

  'common.add': 'Add', 'common.edit': 'Edit', 'common.delete': 'Delete', 'common.save': 'Save',
  'common.cancel': 'Cancel', 'common.close': 'Close', 'common.search': 'Search…', 'common.all': 'All',
  'common.none': '–', 'common.site': 'Site', 'common.allSites': 'All sites', 'common.date': 'Date',
  'common.note': 'Note', 'common.notes': 'Notes', 'common.photos': 'Photos', 'common.addPhoto': 'Add photo',
  'common.name': 'Name', 'common.total': 'Total', 'common.empty': 'No data yet.', 'common.loading': 'Loading…',
  'common.confirmDelete': 'Delete this item?', 'common.saved': 'Saved', 'common.saving': 'Saving…', 'common.deleted': 'Deleted',
  'common.error': 'Something went wrong', 'common.yes': 'Yes', 'common.no': 'No', 'common.status': 'Status',
  'common.seeAll': 'See all', 'common.by': 'by', 'common.year': 'Year', 'common.month': 'Month',
  'common.type': 'Type', 'common.amount': 'Amount', 'common.active': 'Active', 'common.inactive': 'Inactive',
  'common.optional': 'optional', 'common.required': 'required', 'common.today': 'Today',
  'common.unassigned': 'Anyone', 'common.wholeSite': 'Whole site', 'common.demo': 'Demo mode',
  'common.demoHint': 'Sample data, saved in this browser only.', 'common.resetDemo': 'Reset demo data',
  'common.logout': 'Log out', 'common.language': 'Language', 'common.export': 'Export CSV',
  'common.theme': 'Theme', 'theme.system': 'Follow device', 'theme.light': 'Light', 'theme.dark': 'Dark',

  'auth.login': 'Log in', 'auth.username': 'Username or email', 'auth.password': 'Password',
  'auth.failed': 'Wrong username or password', 'auth.tryDemo': 'Try demo mode',
  'auth.firstUser': 'The first account automatically becomes the Owner.',

  'role.owner': 'Owner', 'role.worker': 'Worker',

  'dash.hello': 'Good {part}, {name}!', 'dash.morning': 'morning', 'dash.noon': 'day', 'dash.afternoon': 'afternoon',
  'dash.evening': 'evening', 'dash.todo': 'To do', 'dash.overdue': 'Overdue',
  'dash.dueToday': 'Today', 'dash.dueSoon': 'Next 7 days', 'dash.lowStock': 'Low stock',
  'dash.allStocked': 'All stock levels OK 👍', 'dash.upcomingHarvest': 'Upcoming harvest', 'dash.noHarvest': 'No fruiting trees yet.',
  'dash.latestReports': 'Latest reports', 'dash.treeHealth': 'Tree health', 'dash.flowering': 'Flowering',
  'dash.fruiting': 'Fruiting', 'dash.ready': 'Ready', 'dash.monthIncome': 'Income this month',
  'dash.monthExpense': 'Expenses this month', 'dash.monthHarvest': 'Harvest this month', 'dash.trees': 'Trees',
  'dash.openTasks': 'Open tasks', 'dash.nothingDue': 'Nothing urgent. Time for a coffee ☕',
  'dash.markDone': 'Mark done', 'dash.openGarden': 'Open 3D garden',

  'garden.reset': 'Reset view', 'garden.zoomIn': 'Zoom in', 'garden.zoomOut': 'Zoom out', 'garden.mode3d': '3D', 'garden.mode2d': '2D (light)',
  'garden.legend': 'Legend', 'garden.hint': 'Drag to rotate · pinch/scroll to zoom · click a tree for details',
  'garden.hint2d': 'Pinch/scroll or the +/− buttons to zoom · drag to move the map · click a tree for details',
  'garden.needsWater': 'Needs water', 'garden.needsCare': 'Schedule overdue', 'garden.sick': 'Sick / check',
  'garden.ready': 'Ready to harvest', 'garden.flowering': 'Flowering', 'garden.fruiting': 'Fruiting',
  'garden.effects': 'Effects', 'garden.time': 'Time', 'garden.timeNow': 'Now', 'garden.weatherAuto': 'Live weather',
  'garden.emptySite': 'No trees in this site yet. Add them under Trees.', 'garden.noWebgl': 'This device does not support 3D. Showing the 2D map.',
  'garden.loading3d': 'Preparing 3D garden…', 'garden.quality': 'Graphics quality', 'garden.qLow': 'Battery saver', 'garden.qHigh': 'High quality', 'garden.loadFailed': 'Could not load 3D. Showing the 2D map.',

  'tree.name': 'Tree name', 'tree.variety': 'Variety', 'tree.row': 'Row', 'tree.col': 'Column',
  'tree.position': 'Position', 'tree.plantedOn': 'Planted on', 'tree.age': 'Age', 'tree.phase': 'Phase',
  'tree.health': 'Health', 'tree.add': 'Add tree', 'tree.bulk': 'Add many', 'tree.history': 'History',
  'tree.nextCare': 'Next schedule', 'tree.expectedHarvest': 'Expected harvest', 'tree.totalHarvest': 'Total harvest',
  'page.range': '{from}–{to} of {n}', 'page.perPage': '{n} / page', 'page.size': 'Rows per page', 'page.page': 'Page',
  'page.of': 'Page {p} of {n}', 'page.prev': 'Previous page', 'page.next': 'Next page',
  'tree.count': '{n} trees', 'tree.nameTaken': 'Name already used in this site', 'tree.spotTaken': 'Spot already taken',
  'tree.bulkHelp': 'Auto-fill the grid: trees are named {code}-1, {code}-2, … in empty spots.',
  'tree.bulkCount': 'Number of trees', 'tree.bulkStart': 'Start number', 'tree.youngGroup': 'Young (1–2 yr)',
  'tree.matureGroup': 'Mature (5+ yr)', 'tree.find': 'Find tree (e.g. DH-12)', 'tree.recordEvent': 'Record event',
  'tree.problems': 'Active problems',

  'phase.vegetative': 'Growing', 'phase.flowering': 'Flowering', 'phase.fruiting': 'Fruiting', 'phase.ready': 'Ready to harvest',
  'health.healthy': 'Healthy', 'health.watch': 'Watch', 'health.sick': 'Sick', 'health.dead': 'Dead',
  'stage.0': 'Seedling', 'stage.1': 'Young', 'stage.2': 'Growing', 'stage.3': 'Mature',

  'sched.title': 'Schedule name', 'sched.kind': 'Activity', 'sched.every': 'Repeat every', 'sched.days': 'days',
  'sched.nextDue': 'Due', 'sched.supply': 'Supply used', 'sched.dose': 'Dose per tree',
  'sched.target': 'For', 'sched.assigned': 'Assigned to', 'sched.add': 'Add schedule', 'sched.done': 'Mark done',
  'sched.estimate': 'Estimated use: {qty}', 'sched.lastDone': 'Last done', 'sched.never': 'Never',
  'sched.history': 'Done', 'sched.everyN': 'every {n} days',

  'kind.fertilizing': 'Fertilizing', 'kind.spraying': 'Spraying', 'kind.watering': 'Watering',
  'kind.pruning': 'Pruning', 'kind.weeding': 'Weeding', 'kind.other': 'Other',

  'act.log': 'Log activity', 'act.qtyUsed': 'Amount used', 'act.doneOn': 'Done on',
  'act.stockWillDrop': 'Stock will be reduced automatically.', 'act.fromSchedule': 'From schedule',

  'task.title': 'Task title', 'task.desc': 'Description', 'task.assignee': 'Assigned to', 'task.due': 'Due date',
  'task.add': 'Add task', 'task.todo': 'To do', 'task.done': 'Done', 'task.complete': 'Mark done',
  'task.doneNote': 'Completion note', 'task.doneBy': 'Completed by', 'task.mine': 'My tasks',

  'report.add': 'New report', 'report.workDone': 'Work done today', 'report.issues': 'Problems / findings',
  'report.author': 'Reporter', 'report.placeholderWork': 'e.g. NPK on 24 trees north block, weeding…',
  'report.placeholderIssues': 'e.g. MK-7 leaves yellowing, caterpillars on BW-3…', 'report.sent': 'Report sent. Thank you!',
  'report.todayDone': "Today's report already sent",

  'event.kind': 'Record type', 'event.flowering': 'Started flowering', 'event.fruit_set': 'Fruit set',
  'event.pest': 'Pest', 'event.disease': 'Disease', 'event.treatment': 'Treatment', 'event.note': 'Note',
  'event.severity': 'Severity', 'event.count': 'Fruit count', 'event.titleLabel': 'Pest / disease name',
  'event.resolved': 'Resolved', 'event.markResolved': 'Mark resolved', 'event.add': 'Record',
  'sev.low': 'Low', 'sev.medium': 'Medium', 'sev.high': 'High',

  'harvest.add': 'Record harvest', 'harvest.fruits': 'Fruit count', 'harvest.weight': 'Weight (kg)', 'harvest.grade': 'Grade',
  'harvest.perTree': 'Harvest per tree', 'harvest.perSite': 'Harvest per site', 'harvest.avgFruit': 'Average per fruit',
  'harvest.thisYear': 'Harvest this year', 'harvest.topTrees': 'Most productive trees', 'harvest.markReady': 'Mark fruiting again / done',

  'stock.add': 'Add supply', 'stock.category': 'Category', 'stock.unit': 'Unit', 'stock.current': 'Stock',
  'stock.min': 'Minimum level', 'stock.price': 'Price per unit', 'stock.buy': 'Buy / add stock',
  'stock.adjust': 'Correct stock', 'stock.movements': 'Stock history', 'stock.low': 'Low', 'stock.ok': 'OK',
  'stock.qty': 'Quantity', 'stock.recordExpense': 'Also record as an expense', 'stock.newStock': 'Actual stock',
  'reason.purchase': 'Purchase', 'reason.usage': 'Usage', 'reason.adjust': 'Correction',
  'cat.fertilizer': 'Fertilizer', 'cat.pesticide': 'Pesticide', 'cat.fungicide': 'Fungicide', 'cat.other': 'Other',

  'fin.income': 'Income', 'fin.expense': 'Expenses', 'fin.profit': 'Profit', 'fin.sales': 'Sales',
  'fin.expenses': 'Expenses', 'fin.addSale': 'Record sale', 'fin.addExpense': 'Record expense',
  'fin.buyer': 'Buyer', 'fin.pricePerKg': 'Price per kg', 'fin.perSite': 'Per site', 'fin.perMonth': 'Per month',
  'fin.shared': 'Shared (all sites)', 'fin.category': 'Category', 'fin.margin': 'Margin',
  'exp.labor': 'Labor', 'exp.fertilizer': 'Fertilizer', 'exp.pesticide': 'Pesticide', 'exp.fuel': 'Fuel',
  'exp.tools': 'Tools', 'exp.transport': 'Transport', 'exp.other': 'Other',

  'weather.now': 'Now', 'weather.humidity': 'Humidity', 'weather.wind': 'Wind', 'weather.rain': 'Rain',
  'weather.forecast': '5-day forecast', 'weather.tips': 'Farm tips', 'weather.noLocation': 'Set the site location in Settings to see the weather.',
  'weather.failed': 'Could not load weather.',
  'sensor.title': 'Garden sensor', 'sensor.live': 'Live from the garden', 'sensor.temp': 'Temperature',
  'sensor.updated': 'Updated {when}', 'sensor.offline': 'Offline', 'sensor.history': 'Recent history',
  'sensor.range24h': '24 h', 'sensor.rangeDays': '{n} days',
  'sensor.stale': 'No data from the sensor since {when}. Check its power and WiFi.', 'sensor.failed': 'Could not load sensor data.',
  'sky.clear': 'Clear', 'sky.partly': 'Partly cloudy', 'sky.cloudy': 'Cloudy', 'sky.fog': 'Foggy', 'sky.rain': 'Rain', 'sky.storm': 'Thunderstorm',
  'tip.noSpray': 'High chance of rain — postpone spraying, it may wash off.',
  'tip.wind': 'Strong wind — avoid spraying, check stakes on young trees.',
  'tip.drainage': 'Heavy rain expected — check drainage, durian is prone to root rot (Phytophthora).',
  'tip.dry': 'Dry for several days — keep an eye on watering young trees.',
  'tip.fungus': 'Warm and humid — watch for fungus on trunks and leaves.',
  'tip.good': 'Good weather for farm work.',

  'user.add': 'Add user', 'user.fullName': 'Full name', 'user.username': 'Username', 'user.password': 'Password',
  'user.role': 'Role', 'user.setPassword': 'Change password', 'user.block': 'Block', 'user.unblock': 'Activate',
  'user.help': 'Workers log in to the phone app with this username and password.', 'user.workerCan': 'Workers can: send daily reports, finish tasks, log fertilizing/spraying, pests, harvest. They cannot see finance.',

  'set.sites': 'Sites', 'set.addSite': 'Add site', 'set.area': 'Area (ha)', 'set.lat': 'Latitude', 'set.lng': 'Longitude',
  'set.gridRows': 'Rows', 'set.gridCols': 'Columns', 'set.spacing': 'Spacing (m)', 'set.varieties': 'Varieties',
  'set.addVariety': 'Add variety', 'set.code': 'Code', 'set.color': 'Leaf color (3D)', 'set.daysToRipe': 'Days to ripen',
  'set.locHelp': 'Open Google Maps, long-press the site, copy the coordinates.', 'set.useMyLocation': 'Use my location',
  'set.data': 'Data', 'set.gridHelp': '1 ha at 8×8 m spacing ≈ 12×12 = 144 planting spots.',

  'mobile.quick': 'Quick log', 'mobile.summary': 'Summary', 'mobile.findTree': 'Find tree',
  'mobile.chooseSite': 'Choose site', 'mobile.chooseTree': 'Choose tree', 'mobile.camera': 'Camera', 'mobile.gallery': 'Gallery',
  'mobile.uploading': 'Uploading photo…', 'mobile.helloWorker': 'Hi, {name} 👋', 'mobile.yesterday': 'Yesterday',
  'mobile.myTasks': 'My tasks', 'mobile.dueWork': 'Farm schedule', 'mobile.noTasks': 'No tasks. Nice! 👍', 'mobile.photoHint': 'Long-press a photo to remove it.', 'mobile.send': 'Send', 'mobile.demoLogin': 'Demo mode: log in as pemilik, budi or sari (any password).',
};

const dicts: Record<Lang, Record<TKey, string>> = { id, en };

let current: Lang = 'id';
const listeners = new Set<(l: Lang) => void>();

export function setLang(l: Lang) {
  current = l;
  listeners.forEach((f) => f(l));
}
export function getLang(): Lang {
  return current;
}
export function onLangChange(f: (l: Lang) => void) {
  listeners.add(f);
  return () => listeners.delete(f);
}

/** Translate a key, replacing {placeholders}. Unknown keys return the key itself. */
export function t(key: TKey | string, vars?: Record<string, string | number>): string {
  let s = (dicts[current] as Record<string, string>)[key] ?? (dicts.id as Record<string, string>)[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
