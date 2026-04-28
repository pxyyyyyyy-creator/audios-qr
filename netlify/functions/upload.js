exports.handler = async (event, context) => {
    // Apenas requisições POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const data = JSON.parse(event.body);
        const filename = data.filename;
        const base64Content = data.content;

        // Lemos essas variáveis que você vai configurar como "Environment Variables" no painel do Netlify
        const githubToken = process.env.GITHUB_TOKEN;
        const owner = process.env.GITHUB_OWNER || 'Pinho47';
        const repo = process.env.GITHUB_REPO || 'audios-qr';
        const branch = process.env.GITHUB_BRANCH || 'master';
        const path = `uploads/${filename}`;

        if (!githubToken) {
            return {
                statusCode: 500,
                body: JSON.stringify({ message: "Servidor não configurado. GITHUB_TOKEN ausente nas variáveis de ambiente." })
            };
        }

        const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

        // Verifica se o arquivo já existe e pega a hash (SHA) para permitir sobrescrita
        let sha = '';
        const checkResponse = await fetch(url, {
            headers: {
                'Authorization': `token ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Audio-QR-Netlify-Function'
            }
        });
        if (checkResponse.ok) {
            const fileData = await checkResponse.json();
            sha = fileData.sha;
        }

        // Faz o upload direto pro GitHub
        const uploadResponse = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                'User-Agent': 'Audio-QR-Netlify-Function'
            },
            body: JSON.stringify({
                message: `Upload automatico: ${filename}`,
                content: base64Content,
                sha: sha ? sha : undefined,
                branch: branch
            })
        });

        if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            return {
                statusCode: uploadResponse.status,
                body: JSON.stringify({ message: `Erro na API do GitHub: ${errorData.message}` })
            };
        }

        const uploadResult = await uploadResponse.json();
        
        // Retorna a URL bruta (raw) que o GitHub hospedou
        const downloadUrl = uploadResult.content.download_url || `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;

        return {
            statusCode: 200,
            body: JSON.stringify({ url: downloadUrl })
        };

    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({ message: err.message })
        };
    }
};
