document.addEventListener('DOMContentLoaded', function() {
    const apiKeyInput = document.getElementById('api-key');
    const analyzeBtn = document.getElementById('analyze-btn');
    const statusDiv = document.getElementById('status');
    const ecoScoreValueDiv = document.getElementById('eco-score-value');

    chrome.storage.sync.get(['groq_api_key'], function(result) {
        if (result.groq_api_key) {
            apiKeyInput.value = result.groq_api_key;
        }
    });

    analyzeBtn.addEventListener('click', async function() {
        const apiKey = apiKeyInput.value.trim();

        if (!apiKey) {
            updateStatus('❌ Please enter Grok API Key', '#d32f2f');
            return;
        }

        chrome.storage.sync.set({ 'groq_api_key': apiKey });

        analyzeBtn.disabled = true;
        analyzeBtn.textContent = '⏳ Analyzing...';
        updateStatus('Analyzing product...', '#1976d2');
        ecoScoreValueDiv.textContent = '';

        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const currentTab = tabs[0];

            const response = await new Promise((resolve, reject) => {
                chrome.tabs.sendMessage(
                    currentTab.id,
                    { action: 'extractProductData' },
                    function(response) {
                        if (chrome.runtime.lastError) {
                            reject(new Error('Content script not ready'));
                        } else {
                            resolve(response);
                        }
                    }
                );
            });

            if (!response || !response.success) {
                throw new Error('Could not extract product data');
            }

            const productData = response.data;
            const desc = (productData.description + ' ' + productData.name).toLowerCase();

            // UNIVERSAL MATERIAL SCORING - Works on BOTH Amazon & Flipkart
            let score = 50;
            let materialScore = 50;
            let reason = '';

            // ANALYZE MATERIAL
            if (desc.includes('organic cotton')) {
                if (desc.includes('certified') || desc.includes('fair trade') || desc.includes('usda')) {
                    score = 92;
                    materialScore = 92;
                    reason = 'Certified organic cotton - excellent eco choice';
                } else {
                    score = 88;
                    materialScore = 88;
                    reason = 'Organic cotton material';
                }
            }
            else if (desc.includes('organic') && (desc.includes('fabric') || desc.includes('cloth') || desc.includes('cotton'))) {
                score = 87;
                materialScore = 87;
                reason = 'Organic fabric material';
            }
            else if (desc.includes('organic')) {
                score = 85;
                materialScore = 85;
                reason = 'Organic material product';
            }
            else if (desc.includes('bamboo') && desc.includes('organic')) {
                score = 82;
                materialScore = 82;
                reason = 'Organic bamboo - sustainable';
            }
            else if (desc.includes('bamboo')) {
                score = 78;
                materialScore = 78;
                reason = 'Bamboo material - good eco choice';
            }
            else if (desc.includes('hemp') || desc.includes('linen')) {
                score = 80;
                materialScore = 80;
                reason = 'Natural hemp/linen material';
            }
            else if (desc.includes('recycled') && !desc.includes('plastic')) {
                score = 75;
                materialScore = 75;
                reason = 'Recycled material product';
            }
            else if (desc.includes('cotton') && !desc.includes('polyester') && !desc.includes('blend')) {
                score = 68;
                materialScore = 68;
                reason = 'Cotton material - moderate impact';
            }
            else if (desc.includes('wood') || desc.includes('wooden')) {
                score = 70;
                materialScore = 70;
                reason = 'Wooden product';
            }
            else if (desc.includes('paper') || desc.includes('cardboard')) {
                score = 72;
                materialScore = 72;
                reason = 'Paper/cardboard material';
            }
            else if (desc.includes('fabric') || desc.includes('cloth')) {
                score = 52;
                materialScore = 52;
                reason = 'Material type unclear - needs info';
            }
            else if (desc.includes('polyester') || desc.includes('nylon') || desc.includes('acrylic')) {
                score = 35;
                materialScore = 35;
                reason = 'Synthetic materials - low eco score';
            }
            else if (desc.includes('plastic')) {
                score = 20;
                materialScore = 20;
                reason = 'Plastic product - poor for environment';
            }
            else {
                score = 50;
                materialScore = 50;
                reason = 'Product details unclear';
            }

            score = Math.max(0, Math.min(100, Math.round(score)));

            // DETERMINE GRADE
            let grade = 'F';
            let gradeColor = '#C62828';
            
            if (score >= 90) {
                grade = 'A+';
                gradeColor = '#1B5E20';
            } else if (score >= 80) {
                grade = 'A';
                gradeColor = '#2E7D32';
            } else if (score >= 70) {
                grade = 'B+';
                gradeColor = '#558B2F';
            } else if (score >= 60) {
                grade = 'B';
                gradeColor = '#66BB6A';
            } else if (score >= 50) {
                grade = 'C';
                gradeColor = '#FFA726';
            } else if (score >= 40) {
                grade = 'D';
                gradeColor = '#EF5350';
            } else {
                grade = 'F';
                gradeColor = '#C62828';
            }

            updateStatus('Getting summary...', '#1976d2');

            const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [{
                        role: 'user',
                        content: `Product: ${productData.name}
Score: ${score}, Grade: ${grade}

Write 2-sentence eco assessment and 3 tips.

JSON only:
{
  "summary": "assessment",
  "tips": ["tip1", "tip2", "tip3"]
}`
                    }],
                    temperature: 0.2,
                    max_tokens: 300
                })
            });

            if (!groqResponse.ok) {
                throw new Error('API error');
            }

            const groqData = await groqResponse.json();
            const responseText = groqData.choices[0].message.content;
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            
            let aiData = { summary: reason, tips: ['Use responsibly', 'Recycle properly', 'Choose certified products'] };
            if (jsonMatch) {
                try {
                    aiData = JSON.parse(jsonMatch[0]);
                } catch(e) {}
            }

            const analysis = {
                score: score,
                grade: grade,
                summary: aiData.summary || reason,
                breakdown: {
                    materials: materialScore,
                    certifications: 50,
                    manufacturing: 50,
                    packaging: 50,
                    carbon_footprint: 50
                },
                tips: aiData.tips || ['Use responsibly', 'Recycle properly', 'Choose certified products']
            };

            updateStatus('✅ Analysis complete!', '#388e3c');

            let resultHTML = `<div style="text-align: center;">
                <div style="font-size: 2.2em; font-weight: bold; color: #2e7d32;">${analysis.score}</div>
                <div style="font-size: 1.1em; font-weight: bold; color: ${gradeColor};">Grade ${analysis.grade}</div>
            </div>`;

            ecoScoreValueDiv.innerHTML = resultHTML;

            setTimeout(function() {
                chrome.tabs.sendMessage(currentTab.id, {
                    action: 'showWidget',
                    analysis: analysis
                });
            }, 300);

        } catch (error) {
            console.error('Error:', error);
            updateStatus('❌ ' + error.message, '#d32f2f');
        } finally {
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = '🔍 Analyze Eco-Score';
        }
    });

    function updateStatus(msg, color) {
        if (statusDiv) {
            statusDiv.textContent = msg;
            statusDiv.style.color = color;
        }
    }
});
