const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// CONFIGURATION
const PORT = 5000;
const STORAGE_ROOT = path.resolve(__dirname, 'school_data');
const ENCRYPTION_KEY = Buffer.from('0123456789abcdef0123456789abcdef');
const IV_LENGTH = 16;
const safeSegment = (value) => String(value || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');

//Ensure storage root exists
if (!fs.existsSync(STORAGE_ROOT)) fs.mkdirSync(STORAGE_ROOT);

// MULTER SETUP for local file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const schoolId = safeSegment(req.body.schoolId);
        const dir = path.join(STORAGE_ROOT, schoolId, 'uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => cb (null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

//ENCRYPTION UTILITIES
function encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

//ENDPOINTS
// 1. Admin: Upload Marks via CSV
app.post('/admin/upload-marks', upload.single('file'), (req, res) => {
    const requestedSchoolId = req.body.schoolId;
    if (!requestedSchoolId || !req.file) {
        return res.status(400).json({ error: 'schoolId and a CSV file are required.' });
    }
    const schoolId = safeSegment(requestedSchoolId);
    const results = [];

    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
            const encryptedData = encrypt(JSON.stringify(results));
            const schoolDir = path.join(STORAGE_ROOT, schoolId);
            if (!fs.existsSync(schoolDir)) fs.mkdirSync(schoolDir, {
                recursive: true
            });

            fs.writeFileSync(path.join(schoolDir, 'marks.enc'), encryptedData);
            fs.unlinkSync(req.file.path); // Delete raw CSV after processing
            res.json({ message: "Marks uploaded and encrypted successfully."});
        })
        .on('error', (error) => {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            res.status(400).json({ error: `Could not parse CSV: ${error.message}` });
        });
});

// 2. Student: Download Assignment
app.get('/student/download/:schoolId/:filename', (req, res) => {
    const uploadDir = path.resolve(STORAGE_ROOT, safeSegment(req.params.schoolId), 'uploads');
    const filePath = path.resolve(uploadDir, req.params.filename);
    if (!filePath.startsWith(`${uploadDir}${path.sep}`)) {
        return res.status(400).send("Invalid file path");
    }
    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).send("File not found");
    }
});

// 3. Student: View Marks
app.get('/student/marks/:schoolId/:studentId', (req,res) => {
    const filePath = path.join(STORAGE_ROOT, safeSegment(req.params.schoolId), 'marks.enc');
    if (!fs.existsSync(filePath)) return res.status(404).send("No marks found");

    const encryptedData = fs.readFileSync(filePath, 'utf8');
    const marks = JSON.parse(decrypt(encryptedData));
    const studentMark = marks.find(m => m.studentId === req.params.studentId);

    studentMark ? res.json(studentMark) : res.status(404).send("Student record not found");
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));