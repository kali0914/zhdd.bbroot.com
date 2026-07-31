// ============================================================
//  公共工具函数（所有页面共享）
// ============================================================

// ---------- 配置 ----------
const API_BASE = 'https://api.ygsl.us.ci/repos/2401_89130991/kali0914';
const CONFIG_PATH = 'data/site_config.json';
const ENC_KEY_SALT = 'AgiRvAjgzGvMZn1jYEXH8N2sZHDD-SALT';
const GITCODE_RAW_BASE = 'https://gitcode.com/2401_89130991/kali0914/raw/main';

// ---------- GitCode 访问令牌 ----------
const GITCODE_TOKEN = '这里填你生成的Token';  // 替换！

// ---------- 明文 JSON 配置加载 ----------
async function loadSiteConfig() {
    try {
        // 直接用 gitcodeGetFile 读取
        const content = await gitcodeGetFile(CONFIG_PATH);
        if (!content) throw new Error('配置不存在');
        return JSON.parse(content);
    } catch (e) {
        console.warn('加载配置失败，使用默认值', e);
        return null;
    }
}

// ---------- GitCode 文件读取（API v4 + Token） ----------
async function gitcodeGetFile(path) {
    const projectId = encodeURIComponent('2401_89130991/kali0914');
    const filePath = encodeURIComponent(path);
    const url = `https://gitcode.com/api/v4/projects/${projectId}/repository/files/${filePath}/raw?ref=main`;
    
    try {
        const res = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${GITCODE_TOKEN}`,
                'Accept': 'application/json'
            }
        });
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.text();
    } catch (e) {
        console.warn('读取文件失败:', path, e);
        return null;
    }
}

// ... 其余函数保持不变 ...
