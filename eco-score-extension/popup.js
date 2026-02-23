const API_URL = 'http://localhost:5000/api/eco-score';

let checkBtn, retryBtn, checkAnotherBtn, analyzeBtn;
let initialState, loadingState, errorState, resultsState, errorMessage;
let currentProductData = null;

document.addEventListener('DOMContentLoaded', () => {
    checkBtn        = document.getElementById('checkBtn');
    retryBtn        = document.getElementById('retryBtn');
    checkAnotherBtn = document.getElementById('checkAnotherBtn');
    analyzeBtn      = document.getElementById('analyzeBtn');
    initialState    = document.getElementById('initialState');
    loadingState    = document.getElementById('loadingState');
    errorState      = document.getElementById('errorState');
    resultsState    = document.getElementById('resultsState');
    errorMessage    = document.getElementById('errorMessage');

    checkBtn.addEventListener('click', checkProduct);
    retryBtn.addEventListener('click', resetToInitial);
    checkAnotherBtn.addEventListener('click', resetToInitial);
    analyzeBtn.addEventListener('click', analyzeWithAI);

    // Settings link
    document.getElementById('settingsLink').addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
    });
    document.getElementById('settingsLink2').addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
    });
});

async function getCurrentTab() {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs[0]) resolve(tabs[0]);
            else reject(new Error('No active tab found'));
        });
    });
}

function detectPlatform(url) {
    if (url.includes('amazon'))   return 'amazon';
    if (url.includes('flipkart')) return 'flipkart';
    return null;
}

// Read page text directly from browser
// This works because the browser already rendered all JavaScript
async function extractPageText(tabId, platform) {
    return new Promise((resolve) => {
        chrome.scripting.executeScript(
            {
                target: { tabId: tabId },
                func: (platform) => {
                    let title = '';
                    let text  = '';

                    if (platform === 'amazon') {
                        const titleEl = document.getElementById('productTitle');
                        if (titleEl) title = titleEl.innerText.trim();
                        const ids = [
                            'feature-bullets', 'productDescription',
                            'prodDetails', 'detailBullets_feature_div',
                            'productDetails_techSpec_section_1'
                        ];
                        ids.forEach(id => {
                            const el = document.getElementById(id);
                            if (el) text += ' ' + el.innerText;
                        });
                        text += ' ' + document.body.innerText;

                    } else if (platform === 'flipkart') {
                        text = document.body.innerText;
                        const selectors = ['.VU-ZEz','.yhB1nd','.B_NuCI','._35KyD6','.G6XhRU','h1'];
                        for (const sel of selectors) {
                            const el = document.querySelector(sel);
                            if (el && el.innerText.trim()) { title = el.innerText.trim(); break; }
                        }
                    }

                    if (!title) title = document.title.split('|')[0].split('-')[0].trim();
                    const fullText = (title + ' ' + text).toLowerCase();
                    return { title, text: fullText, length: fullText.length };
                },
                args: [platform]
            },
            (results) => {
                if (results && results[0] && results[0].result) resolve(results[0].result);
                else resolve({ title: 'Unknown Product', text: '', length: 0 });
            }
        );
    });
}

async function checkProduct() {
    try {
        showState('loading');
        document.getElementById('loadingText').textContent = 'Analyzing product...';

        const tab      = await getCurrentTab();
        const url      = tab.url;
        const platform = detectPlatform(url);

        if (!platform) {
            throw new Error('❌ Only Amazon and Flipkart are supported!\nPlease visit a product page on Amazon.in or Flipkart.com');
        }

        // Read text from browser (fully rendered page)
        const pageData = await extractPageText(tab.id, platform);
        console.log(`[${platform}] Title: ${pageData.title}`);
        console.log(`[${platform}] Text length: ${pageData.length} chars`);

        // Send to backend
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: url, title: pageData.title,
                text: pageData.text, platform: platform
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to analyze product');
        }

        const data = await response.json();
        data.platformLabel = platform === 'amazon' ? '🛒 Amazon' : '🛍️ Flipkart';
        currentProductData = data; // Store for AI analysis
        displayResults(data);

    } catch (error) {
        console.error('Error:', error);
        showError(error.message);
    }
}

function displayResults(data) {
    // Score + Grade
    document.getElementById('scoreValue').textContent = data.eco_score;
    document.getElementById('gradeValue').textContent = `Grade: ${data.grade}`;
    document.getElementById('scoreCircle').className  = 'score-circle score-' + data.grade.toLowerCase();

    // Product name + platform
    document.getElementById('productName').textContent   = data.details.product_name || 'Product';
    document.getElementById('platformBadge').textContent = data.platformLabel || '';

    // Materials - show as text list
    const materials = data.details.materials || [];
    document.getElementById('materials').textContent =
        materials.length > 0 && materials[0] !== 'Material information not available'
            ? materials.join(', ')
            : 'Not detected';

    // Certifications - show as text list
    const certs = data.details.certifications || [];
    document.getElementById('certifications').textContent =
        certs.length > 0 && certs[0] !== 'No certifications detected'
            ? certs.join(', ')
            : 'None found';

    // Packaging - check positive factors
    const pf = data.details.positive_factors || [];
    document.getElementById('packaging').textContent =
        pf.some(f => f.toLowerCase().includes('packaging'))
            ? '✓ Eco-friendly packaging'
            : 'Standard packaging';

    // Greenwashing
    document.getElementById('greenwashing').textContent =
        data.details.greenwashing_detected
            ? '⚠️ Greenwashing detected'
            : '✓ No greenwashing found';

    // Recommendations list
    const recList = document.getElementById('recommendationsList');
    recList.innerHTML = '';
    const recs = data.details.recommendations || [];
    recs.forEach(rec => {
        const li = document.createElement('li');
        li.textContent = rec;
        recList.appendChild(li);
    });
    document.getElementById('recommendationsContainer')
        .classList.toggle('hidden', recs.length === 0);

    // Clear AI results when showing new product
    document.getElementById('aiResultsContainer').classList.add('hidden');
    document.getElementById('aiResults').textContent = '';
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = 'Analyze with AI';

    showState('results');
}

async function analyzeWithAI() {
    if (!currentProductData) {
        showError('No product data available');
        return;
    }

    try {
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = 'Analyzing...';
        document.getElementById('loadingText').textContent = 'Running AI analysis...';
        showState('loading');

        // Get Gemini API key from Chrome storage
        const settings = await chrome.storage.sync.get(['gemini_key']);
        const geminiKey = settings.gemini_key;

        if (!geminiKey) {
            throw new Error('❌ Gemini API key not configured.\n\nPlease set your API key in Settings first.\n\n1. Click the ⚙️ Settings link\n2. Paste your Gemini API key\n3. Click Save Settings');
        }

        const productInfo = `
Product: ${currentProductData.details.product_name}
Platform: ${currentProductData.details.platform}
Eco-Score: ${currentProductData.eco_score}/100 (Grade: ${currentProductData.grade})
Materials: ${(currentProductData.details.materials || []).join(', ') || 'Not specified'}
Certifications: ${(currentProductData.details.certifications || []).join(', ') || 'None'}
Greenwashing Detected: ${currentProductData.details.greenwashing_detected ? 'Yes' : 'No'}
        `;

        const prompt = `You are an environmental sustainability expert. Analyze this product and provide a detailed AI-powered assessment of its environmental impact, sustainability, and eco-friendliness. Include:

1. Overall Sustainability Assessment (2-3 sentences)
2. Environmental Concerns (2-3 bullet points)
3. Positive Aspects (2-3 bullet points)
4. Recommendations for Improvement (2-3 bullet points)
5. Overall Verdict (1-2 sentences)

Product Information:
${productInfo}

Provide a comprehensive but concise analysis.`;

        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + geminiKey, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            })
        });

        if (!response.ok) {
            const error = await response.json();
            if (response.status === 401) {
                throw new Error('❌ Invalid Gemini API key.\n\nPlease check your API key in Settings.');
            }
            throw new Error('AI analysis failed: ' + (error.error?.message || 'Unknown error'));
        }

        const data = await response.json();
        const analysisText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No analysis generated';

        // Show results back in popup
        document.getElementById('aiResults').textContent = analysisText;
        document.getElementById('aiResultsContainer').classList.remove('hidden');

        showState('results');
        analyzeBtn.textContent = 'Analyze with AI';
        analyzeBtn.disabled = false;

    } catch (error) {
        console.error('AI Analysis Error:', error);
        analyzeBtn.textContent = 'Analyze with AI';
        analyzeBtn.disabled = false;
        showError(error.message);
    }
}

function showError(msg) {
    errorMessage.textContent = msg;
    showState('error');
}

function showState(state) {
    [initialState, loadingState, errorState, resultsState]
        .forEach(el => { if (el) el.classList.add('hidden'); });
    const map = { initial: initialState, loading: loadingState, error: errorState, results: resultsState };
    if (map[state]) map[state].classList.remove('hidden');
}

function resetToInitial() { 
    currentProductData = null;
    showState('initial'); 
}
