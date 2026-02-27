chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'extractProductData') {
        try {
            var data = extractData();
            sendResponse({ success: true, data: data });
        } catch (error) {
            console.error('Extract error:', error);
            sendResponse({ success: false, error: error.message });
        }
    }
    
    if (request.action === 'showWidget') {
        try {
            showEcoScoreWidget(request.analysis);
            sendResponse({ success: true });
        } catch (error) {
            console.error('Widget error:', error);
            sendResponse({ success: true });
        }
    }
    
    return true;
});

function extractData() {
    var url = window.location.href;
    var isAmazon = url.includes('amazon');
    var isFlipkart = url.includes('flipkart');

    var name = 'Unknown Product';
    var description = '';
    var brand = '';

    try {
        if (isAmazon) {
            // AMAZON EXTRACTION
            var titleEl = document.getElementById('productTitle');
            if (titleEl) name = titleEl.innerText.trim();

            var brandEl = document.getElementById('bylineInfo');
            if (brandEl) brand = brandEl.innerText.trim();

            var sections = ['feature-bullets', 'productDescription', 'detailBullets_feature_div', 'aplus'];
            for (var i = 0; i < sections.length; i++) {
                var el = document.getElementById(sections[i]);
                if (el) description += ' ' + el.innerText;
            }
        } else if (isFlipkart) {
            // FLIPKART EXTRACTION - GET EVERYTHING
            
            // Get product title (most important for material detection)
            var titleSelectors = ['span[data-test-id="title"]', 'h1', '.B_NuCI', 'h1.yhB1h3', '.eKTiAo'];
            for (var t = 0; t < titleSelectors.length; t++) {
                var titleEl = document.querySelector(titleSelectors[t]);
                if (titleEl && titleEl.innerText && titleEl.innerText.length > 5) {
                    name = titleEl.innerText.trim();
                    if (name.length > 10) break;
                }
            }

            // Get ALL text from body (Flipkart hides info everywhere)
            var bodyText = document.body.innerText || '';
            
            // Get product description sections
            var descSelectors = [
                '[data-test-id*="description"]',
                '.fRt4Ns',
                '._2t4dHl',
                '._3Djpqc',
                '.N6nrg',
                '.g0qnLb',
                '._27pGVB',
                '[data-fk-edge-index]'
            ];
            
            var descText = '';
            for (var d = 0; d < descSelectors.length; d++) {
                var els = document.querySelectorAll(descSelectors[d]);
                for (var e = 0; e < Math.min(els.length, 20); e++) {
                    var text = els[e].innerText;
                    if (text && text.length > 0 && text.length < 300) {
                        descText += ' ' + text;
                    }
                }
            }

            // Combine everything
            description = (name + ' ' + descText + ' ' + bodyText).substring(0, 6000);
        }
    } catch (e) {
        console.error('Error extracting data:', e);
    }

    name = (name || 'Unknown').replace(/\s+/g, ' ').trim();
    brand = (brand || '').replace(/\s+/g, ' ').trim();
    description = (description || '').replace(/\s+/g, ' ').trim();

    if (description.length > 5000) description = description.substring(0, 5000);
    if (description.length < 20) description = name + ' ' + brand;

    var fullText = (name + ' ' + brand + ' ' + description).toLowerCase();

    console.log('Extracted product:', {
        name: name,
        hasPlastic: fullText.includes('plastic'),
        hasOrganic: fullText.includes('organic'),
        hasBamboo: fullText.includes('bamboo'),
        fullText: fullText.substring(0, 200)
    });

    return {
        name: name,
        brand: brand,
        description: fullText,
        url: url,
        platform: isAmazon ? 'Amazon' : isFlipkart ? 'Flipkart' : 'Unknown'
    };
}

function showEcoScoreWidget(analysis) {
    var existing = document.getElementById('eco-score-widget-container');
    if (existing) existing.remove();

    var container = document.createElement('div');
    container.id = 'eco-score-widget-container';
    
    var gradeColor = '#2E7D32';
    var score = parseInt(analysis.score) || 50;
    var grade = analysis.grade || 'C';
    
    if (grade.includes('A+') || score >= 90) gradeColor = '#1B5E20';
    else if (grade.includes('A') || score >= 80) gradeColor = '#2E7D32';
    else if (grade.includes('B+') || score >= 70) gradeColor = '#558B2F';
    else if (grade.includes('B') || score >= 60) gradeColor = '#66BB6A';
    else if (grade.includes('C+') || score >= 55) gradeColor = '#FBC02D';
    else if (grade.includes('C') || score >= 45) gradeColor = '#FFA726';
    else if (grade.includes('D') || score >= 30) gradeColor = '#EF5350';
    else gradeColor = '#C62828';

    var certHTML = '';
    if (analysis.certifications && analysis.certifications.length > 0) {
        certHTML = '<div style="margin-top: 12px;"><strong style="color: #2e7d32;">✓ Certifications:</strong><div style="margin-top: 8px;">';
        for (var c = 0; c < analysis.certifications.length; c++) {
            certHTML += '<span style="display: inline-block; background: #c8e6c9; color: #1b5e20; padding: 6px 10px; margin: 4px 4px 4px 0; border-radius: 6px; font-size: 0.85em; border: 1px solid #81c784; font-weight: 500;">' + analysis.certifications[c] + '</span>';
        }
        certHTML += '</div></div>';
    } else {
        certHTML = '<div style="margin-top: 12px; background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; border-radius: 4px;"><span style="color: #856404; font-size: 0.9em;">⚠ No certifications found</span></div>';
    }

    var breakdown = analysis.breakdown || {};
    var breakdownHTML = '<div style="margin-top: 14px;">';
    
    var items = [
        { label: 'Materials', value: breakdown.materials || 50 },
        { label: 'Carbon Footprint', value: breakdown.carbon_footprint || 50 },
        { label: 'Certifications', value: breakdown.certifications || 50 },
        { label: 'Manufacturing', value: breakdown.manufacturing || 50 },
        { label: 'Packaging', value: breakdown.packaging || 50 }
    ];
    
    for (var b = 0; b < items.length; b++) {
        var item = items[b];
        breakdownHTML += '<div style="display: flex; justify-content: space-between; align-items: center; margin: 8px 0; font-size: 0.9em;">' +
            '<span style="color: #2e7d32; font-weight: 500;">' + item.label + '</span>' +
            '<div style="flex: 1; background: #e0f2e9; height: 10px; margin: 0 10px; border-radius: 5px; overflow: hidden;">' +
            '<div style="background: linear-gradient(90deg, #ffa726, #66bb6a); height: 100%; width: ' + item.value + '%; border-radius: 5px;"></div>' +
            '</div>' +
            '<span style="color: #333; font-weight: bold; min-width: 35px; text-align: right;">' + item.value + '</span>' +
            '</div>';
    }
    breakdownHTML += '</div>';

    var tipsHTML = '';
    if (analysis.tips && analysis.tips.length > 0) {
        tipsHTML = '<div style="margin-top: 12px; background: #e8f5e9; border-left: 4px solid #4caf50; padding: 12px; border-radius: 4px;"><strong style="color: #2e7d32;">💡 Tips:</strong><ul style="margin: 8px 0 0 20px; color: #333; font-size: 0.9em;">';
        for (var ti = 0; ti < analysis.tips.length; ti++) {
            tipsHTML += '<li style="margin: 6px 0;">' + analysis.tips[ti] + '</li>';
        }
        tipsHTML += '</ul></div>';
    }

    container.innerHTML = '<div style="position: fixed; bottom: 24px; right: 24px; z-index: 2147483647; width: 400px; max-height: 85vh; background: #f6fff6; border: 2px solid #4caf50; border-radius: 12px; box-shadow: 0 4px 24px rgba(76,175,80,0.3); font-family: Arial, sans-serif; color: #222; overflow-y: auto;">' +
        '<div style="display: flex; justify-content: space-between; align-items: center; background: #4caf50; color: white; padding: 14px 16px; border-radius: 10px 10px 0 0; font-weight: bold;">' +
        '🌿 Eco-Score Analysis' +
        '<button id="eco-widget-close" style="background: none; border: none; color: white; font-size: 24px; cursor: pointer; padding: 0; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">×</button>' +
        '</div>' +
        '<div style="padding: 20px 16px;">' +
        '<div style="text-align: center; margin-bottom: 18px;">' +
        '<div style="width: 130px; height: 130px; border-radius: 50%; background: ' + gradeColor + '; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 0 auto; font-size: 42px; font-weight: bold;">' + score + '</div>' +
        '<div style="font-size: 22px; margin-top: 12px; color: ' + gradeColor + '; font-weight: bold;">Grade ' + grade + '</div>' +
        '</div>' +
        '<div style="margin-bottom: 14px; font-size: 0.95em; color: #333; line-height: 1.6;">' + (analysis.summary || 'Product analysis complete.') + '</div>' +
        certHTML +
        breakdownHTML +
        tipsHTML +
        '</div>' +
        '</div>';

    document.body.appendChild(container);

    setTimeout(function() {
        var closeBtn = document.getElementById('eco-widget-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                container.remove();
            });
        }
    }, 100);
}
