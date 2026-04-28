const fetch = require('node-fetch');

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });
    
    const { password } = req.body;
    if (password !== '112233') {
        return res.status(401).json({ message: 'Senha incorreta!' });
    }

    try {
        const githubToken = process.env.GITHUB_TOKEN;
        const owner = process.env.GITHUB_OWNER || 'pxyyyyyyy-creator';
        const repo = process.env.GITHUB_REPO || 'audios-qr';
        const branch = 'audios-storage';
        const path = 'uploads';

        // 1. Listar arquivos na pasta
        const listRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, {
            headers: { 'Authorization': `token ${githubToken}` }
        });

        if (listRes.status === 404) {
            return res.status(200).json({ message: 'A pasta já está vazia.' });
        }

        const files = await listRes.json();
        if (!Array.isArray(files)) {
             return res.status(200).json({ message: 'Nenhum arquivo encontrado.' });
        }

        // 2. Deletar cada arquivo
        let deletedCount = 0;
        for (const file of files) {
            if (file.type === 'file') {
                await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `token ${githubToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `Limpeza administrativa: ${file.name} [skip ci]`,
                        sha: file.sha,
                        branch: branch
                    })
                });
                deletedCount++;
            }
        }

        return res.status(200).json({ message: `Sucesso! ${deletedCount} áudios foram removidos.` });

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}
