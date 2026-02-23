chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'extractProductData') {
        try {
            var data = extractData();
            sendResponse({ success: true, data: data });
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
        return true;
    }
});

function extractData() {
    var url = window.location.href;
    var isAmazon = url.includes('amazon');
    var isFlipkart = url.includes('flipkart');

    var name = '';
    var description = '';
    var brand = '';

    if (isAmazon) {
        var titleEl = document.getElementById('productTitle');
        if (titleEl) name = titleEl.innerText.trim();

        var brandEl = document.getElementById('bylineInfo');
        if (brandEl) brand = brandEl.innerText.trim();

        var ids = ['feature-bullets', 'productDescription', 'detailBullets_feature_div', 'aplus'];
        for (var i = 0; i < ids.length; i++) {
            var el = document.getElementById(ids[i]);
            if (el) {
                description += ' ' + el.innerText;
            }
        }

        description += ' ' + document.title;

    } else if (isFlipkart) {
        var titleSelectors = ['span[data-test-id="title"]', 'h1._3wU53n', 'h1', '.B_NuCI'];
        for (var j = 0; j < titleSelectors.length; j++) {
            var titleEl = document.querySelector(titleSelectors[j]);
            if (titleEl && titleEl.innerText && titleEl.innerText.trim().length > 5) {
                name = titleEl.innerText.trim();
                if (name.length > 10) break;
            }
        }

        var detailSelectors = ['.fRt4Ns', '._2t4dHl', '._3Djpqc', '.N6nrg'];
        for (var k = 0; k < detailSelectors.length; k++) {
            var elements = document.querySelectorAll(detailSelectors[k]);
            for (var m = 0; m < elements.length; m++) {
                if (elements[m] && elements[m].innerText) {
                    description += ' ' + elements[m].innerText;
                }
            }
        }

        description += ' ' + document.title;
    }

    name = (name || '').replace(/\s+/g, ' ').trim();
    brand = (brand || '').replace(/\s+/g, ' ').trim();
    description = (description || '').replace(/\s+/g, ' ').trim();

    if (description.length > 3000) {
        description = description.substring(0, 3000);
    }

    var fullText = (name + ' ' + brand + ' ' + description).toLowerCase();

    return {
        name: name || 'Unknown Product',
        brand: brand || '',
        description: fullText,
        url: url,
        platform: isAmazon ? 'Amazon' : isFlipkart ? 'Flipkart' : 'Unknown'
    };
}
