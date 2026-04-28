const fetch = require('node-fetch');

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const { filename, content } = req.body;

        const githubToken = process.env.GITHUB_TOKEN;
        const owner = process.env.GITHUB_OWNER || 'pxyyyyyyy-creator';
        const repo = process.env.GITHUB_REPO || 'audios-qr';
        const branch = process.env.GITHUB_BRANCH || 'audios-storage';
        const path = `uploads/${filename}`;

        if (!githubToken) {
            return res.status(500).json({ message: 'GitHub Token não configurado nas variáveis de ambiente.' });
        }

        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${githubToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Upload audio: ${filename} [skip ci]`,
                content: content,
                branch: branch
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ message: `Erro GitHub: ${errorText}` });
        }

        const data = await response.json();
        const downloadUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;

        return res.status(200).json({
            message: 'Upload realizado com sucesso!',
            url: downloadUrl
        });

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}
