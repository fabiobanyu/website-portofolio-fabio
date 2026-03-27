const http = require('http');
const fs = require('fs');

const PORT = 8081;

// Rename the downloaded files to .pdf so we can load them if they exist
try { fs.renameSync('public/certificates/cert-genbi-new.jpg', 'public/certificates/cert-genbi-new.pdf'); } catch(e){}
try { fs.renameSync('public/certificates/cert-pks1-new.jpg', 'public/certificates/cert-pks1-new.pdf'); } catch(e){}

const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    
    if (req.method === 'GET' && req.url === '/') {
        // Serve the converter HTML
        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>PDF to Image</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js"></script>
</head>
<body>
    <h1>Converting PDFs...</h1>
    <script>
    // Configure PDF.js worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

    async function convertPdfToJpg(pdfUrl, name) {
        console.log('Loading ' + pdfUrl);
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        
        // Render at 2x scale for decent quality
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const renderContext = { canvasContext: context, viewport: viewport };
        await page.render(renderContext).promise;
        
        const base64 = canvas.toDataURL('image/jpeg', 0.9);
        
        // POST back to server
        await fetch('http://localhost:8081/save?name=' + name, {
            method: 'POST',
            body: base64
        });
        console.log('Saved ' + name);
    }

    async function processAll() {
        try {
            await convertPdfToJpg('http://localhost:4321/certificates/cert-genbi-new.pdf', 'cert-genbi.jpg');
            await convertPdfToJpg('http://localhost:4321/certificates/cert-pks1-new.pdf', 'cert-pks1.jpg');
            document.body.innerHTML += '<h2>Done! You can close this.</h2>';
            // Tell server to shut down
            await fetch('http://localhost:8081/done', { method: 'POST' });
        } catch(e) {
            document.body.innerHTML += '<p style="color:red">Error: ' + e + '</p>';
        }
    }
    
    processAll();
    </script>
</body>
</html>
        `;
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    } else if (req.method === 'POST' && req.url.startsWith('/save?name=')) {
        const name = new URL(req.url, 'http://localhost').searchParams.get('name');
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            const base64Data = body.replace(/^data:image\/jpeg;base64,/, '');
            fs.writeFileSync('public/certificates/' + name, base64Data, 'base64');
            res.writeHead(200);
            res.end('OK');
        });
    } else if (req.method === 'POST' && req.url === '/done') {
        res.writeHead(200);
        res.end('OK');
        console.log('All conversions done. Shutting down server.');
        server.close();
        process.exit(0);
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(PORT, () => {
    console.log('Converter server running at http://localhost:' + PORT + '/');
});
