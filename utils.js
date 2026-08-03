// ============================================================
//  公共工具函数（所有页面共享）
// ============================================================

// ---------- 配置 ----------
const API_BASE = 'https://api.ygsl.us.ci';
const REPO_OWNER = '2401_89130991';
const REPO_NAME = 'kali0914';
const CONFIG_PATH = 'data/site_config.json';
const ENC_KEY_SALT = 'AgiRvAjgzGvMZn1jYEXH8N2sZHDD-SALT';
const USERS_DIR = 'data/users';

// ---------- EmailJS 配置 ----------
const EMAILJS_SERVICE_ID = 'service_y1zx1nj';
const EMAILJS_TEMPLATE_ID = 'template_h2tzy5w';
const EMAILJS_PUBLIC_KEY = 'i2In4bEy9IyOA9okI';

// ---------- 安全 Base64 解码（支持 UTF-8） ----------
function base64ToUtf8(base64) {
    try {
        return decodeURIComponent(escape(atob(base64)));
    } catch (e) {
        try {
            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            return new TextDecoder('utf-8').decode(bytes);
        } catch (e2) {
            console.warn('Base64 解码失败:', e2);
            return base64;
        }
    }
}

function utf8ToBase64(str) {
    try {
        return btoa(unescape(encodeURIComponent(str)));
    } catch (e) {
        try {
            const bytes = new TextEncoder().encode(str);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return btoa(binary);
        } catch (e2) {
            console.warn('Base64 编码失败:', e2);
            return btoa(str);
        }
    }
}

// ---------- 明文 JSON 配置加载 ----------
async function loadSiteConfig() {
    try {
        const content = await gitcodeGetFile(CONFIG_PATH);
        if (!content) throw new Error('配置不存在');
        return JSON.parse(content);
    } catch (e) {
        console.warn('加载配置失败，使用默认值', e);
        return null;
    }
}

// ---------- GitCode 文件读取 ----------
async function gitcodeGetFile(path) {
    try {
        const url = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(path)}`;
        const res = await fetch(url);
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return base64ToUtf8(data.content);
    } catch (e) {
        console.warn('读取文件失败:', path, e);
        return null;
    }
}

// ---------- GitCode 文件写入 ----------
async function gitcodePutFile(path, content, message) {
    const url = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(path)}`;
    let sha = null;
    try {
        const getRes = await fetch(url);
        if (getRes.ok) {
            const data = await getRes.json();
            sha = data.sha;
        }
    } catch (e) {}
    const payload = {
        message: message || '更新文件',
        content: content
    };
    if (sha) payload.sha = sha;
    const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`写入失败: ${res.status}`);
    return await res.json();
}

// ---------- .zhdd 加密/解密 ----------
async function getEncryptionKey() {
    const encoder = new TextEncoder();
    const data = encoder.encode(ENC_KEY_SALT);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return hash;
}

async function encryptData(data) {
    const keyBuffer = await getEncryptionKey();
    const key = await crypto.subtle.importKey('raw', keyBuffer, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        new TextEncoder().encode(JSON.stringify(data))
    );
    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(encrypted), iv.length);
    return result;
}

async function decryptData(encryptedData) {
    if (!encryptedData || encryptedData.length < 12) return null;
    const keyBuffer = await getEncryptionKey();
    const key = await crypto.subtle.importKey('raw', keyBuffer, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const iv = encryptedData.slice(0, 12);
    const ciphertext = encryptedData.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ciphertext);
    return JSON.parse(new TextDecoder().decode(decrypted));
}

async function loadZhddFile(path, defaultVal) {
    try {
        const base64 = await gitcodeGetFile(path);
        if (!base64) return defaultVal;
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return await decryptData(bytes);
    } catch (e) {
        console.warn('加载 .zhdd 失败:', path, e);
        return defaultVal;
    }
}

async function saveZhddFile(path, data, message) {
    const encrypted = await encryptData(data);
    let binary = '';
    for (let i = 0; i < encrypted.length; i++) binary += String.fromCharCode(encrypted[i]);
    const base64 = btoa(binary);
    await gitcodePutFile(path, base64, message || '更新数据');
}

// ---------- 用户数据辅助 ----------
function getUserFilePath(username, file) {
    return `${USERS_DIR}/${username}/${file}.zhdd`;
}

async function loadUserFile(username, file, defaultVal) {
    return loadZhddFile(getUserFilePath(username, file), defaultVal);
}

async function saveUserFile(username, file, data, message) {
    return saveZhddFile(getUserFilePath(username, file), data, message);
}

// ---------- 头像 URL ----------
function getAvatarUrl(username) {
    return `${API_BASE}/raw/main/avatars/${username}.png`;
}

// ---------- 邮件模板 ----------
async function fetchEmailTemplate(templateName) {
    try {
        const content = await gitcodeGetFile(`data/email_templates/${templateName}.html`);
        if (!content) throw new Error('模板不存在');
        return content;
    } catch (e) {
        const defaults = {
            'register_code': `<h2>验证码</h2><p>您的验证码是：<strong>{{code}}</strong></p>`,
            'reset_password': `<h2>重置密码</h2><p>点击链接重置密码：<a href="{{reset_link}}">重置密码</a></p>`,
            'join_notify': `<h2>新加入申请</h2><p>用户 <strong>{{name}}</strong> ({{email}}) 申请加入。<br>简介：{{bio}}</p>`,
            'join_approved': `<h2>申请通过</h2><p>恭喜 {{name}}，您的加入申请已通过。</p>`
        };
        return defaults[templateName] || `<p>邮件模板缺失</p>`;
    }
}

function renderTemplate(html, vars) {
    let result = html;
    for (const [k, v] of Object.entries(vars)) {
        result = result.replace(new RegExp(`{{${k}}}`, 'g'), v || '');
    }
    return result;
}
