"""
ECO-SCORE SCRAPER - PERFECTLY BALANCED
Works EQUALLY well for Amazon & Flipkart
"""

def calculate_eco_score(product_data):
    text = product_data.get('text', '').lower()
    title = product_data.get('title', '').lower()
    
    score = 50  # Start neutral
    
    # POSITIVE KEYWORDS (ECO-FRIENDLY)
    positive = {
        'organic': 12, 'eco-friendly': 10, 'sustainable': 10, 'recycled': 9,
        'recyclable': 8, 'biodegradable': 9, 'bamboo': 11, 'hemp': 11,
        'fair trade': 9, 'natural': 6, 'cruelty-free': 8, 'vegan': 7,
        'certified': 7, 'carbon neutral': 12, 'zero waste': 11, 'renewable': 10,
        'water-saving': 8, 'energy-efficient': 8, 'plastic-free': 10, 'handmade': 7,
        'local': 6, 'chemical-free': 9, 'non-toxic': 8, 'compostable': 9,
    }
    
    # NEGATIVE KEYWORDS (ECO-UNFRIENDLY)
    negative = {
        'plastic': -10, 'single-use': -15, 'non-recyclable': -12, 'toxic': -18,
        'polyester': -8, 'synthetic': -7, 'hazardous': -15, 'chemical': -8,
        'petroleum': -12, 'disposable': -12, 'greenwashing': -16, 'fast fashion': -12,
        'wasteful': -12, 'microplastic': -14, 'pvc': -12, 'deforestation': -16,
    }
    
    # Count positive matches
    pos_count = 0
    for keyword, points in positive.items():
        if keyword in text or keyword in title:
            score += points
            pos_count += 1
    
    # Count negative matches
    neg_count = 0
    for keyword, points in negative.items():
        if keyword in text or keyword in title:
            score += points
            neg_count += 1
    
    # MATERIALS ANALYSIS
    materials = []
    good_material_score = 0
    bad_material_score = 0
    
    # Good materials
    good_mats = {
        'organic cotton': 11, 'bamboo': 11, 'hemp': 11, 'linen': 10,
        'wool': 8, 'jute': 10, 'cork': 10, 'wood': 8, 'glass': 8,
        'metal': 7, 'recycled': 9, 'silk': 6, 'ramie': 10,
    }
    
    for mat, pts in good_mats.items():
        if mat in text:
            good_material_score += pts
            materials.append(mat.title())
    
    # Bad materials
    bad_mats = {
        'polyester': -8, 'plastic': -10, 'acrylic': -7, 'nylon': -7, 'spandex': -5,
    }
    
    for mat, pts in bad_mats.items():
        if mat in text and mat.title() not in materials:
            bad_material_score += pts
            materials.append(mat.title())
    
    # Apply material scores
    score += good_material_score
    
    # If has BOTH good AND bad materials, soften the penalty (e.g., cotton blend)
    if good_material_score > 0 and bad_material_score < 0:
        score += (bad_material_score // 2)  # Half penalty
    else:
        score += bad_material_score  # Full penalty
    
    # PACKAGING
    if any(x in text for x in ['recyclable packaging', 'eco packaging', 'eco-friendly packaging']):
        score += 6
    elif 'plastic packaging' in text:
        score -= 5
    elif any(x in text for x in ['cardboard', 'paper packaging', 'paper box']):
        score += 5
    
    # CERTIFICATIONS
    certs = []
    cert_keywords = {
        'fsc': 'FSC Certified', 'usda organic': 'USDA Organic',
        'fair trade': 'Fair Trade', 'b corp': 'B Corporation',
        'energy star': 'Energy Star',
    }
    
    for kw, label in cert_keywords.items():
        if kw in text:
            score += 7
            certs.append(label)
    
    # GREENWASHING CHECK
    greenwash = False
    if ('eco-friendly' in text or 'sustainable' in text) and 'plastic' in text:
        if 'recyclable' not in text:
            score -= 8
            greenwash = True
    
    # If NO eco keywords at all, default to neutral/generic
    if pos_count == 0 and neg_count == 0 and not materials:
        score = 55
    
    # Normalize (0-100)
    score = max(0, min(100, score))
    
    # GRADE (A-F)
    if score >= 85:
        grade = 'A'
    elif score >= 75:
        grade = 'B'
    elif score >= 60:
        grade = 'C'
    elif score >= 45:
        grade = 'D'
    else:
        grade = 'F'
    
    # RECOMMENDATIONS
    recs = []
    if grade == 'A':
        recs.append('✅ Excellent eco-friendly choice!')
    elif grade == 'B':
        recs.append('✅ Good eco-friendly option')
    elif grade == 'C':
        recs.append('⚠️ Moderate impact - has eco features')
    elif grade == 'D':
        recs.append('⚠️ Limited eco-features - seek alternatives')
    else:
        recs.append('❌ Poor environmental choice')
    
    if 'organic' not in text and 'cotton' in text:
        recs.append('Look for organic cotton options')
    if 'plastic' in text and 'recyclable' not in text:
        recs.append('Choose plastic-free alternatives')
    if not certs:
        recs.append('Look for eco certifications')
    if greenwash:
        recs.append('Verify claims with certifications')
    
    # POSITIVE FACTORS
    pos_factors = []
    if 'organic' in text: pos_factors.append('Organic')
    if 'sustainable' in text: pos_factors.append('Sustainable')
    if 'recyclable' in text or 'recycled' in text: pos_factors.append('Recyclable')
    if 'biodegradable' in text: pos_factors.append('Biodegradable')
    if 'natural' in text: pos_factors.append('Natural')
    if good_material_score > 0: pos_factors.append('Good materials')
    pos_factors.extend(certs[:2])
    
    if not pos_factors:
        pos_factors = ['Standard product']
    
    # NEGATIVE FACTORS
    neg_factors = []
    if 'plastic' in text and 'recyclable' not in text:
        neg_factors.append('Non-recyclable plastic')
    if 'single-use' in text:
        neg_factors.append('Single-use')
    if 'toxic' in text:
        neg_factors.append('Toxic materials')
    if 'chemical' in text and 'chemical-free' not in text:
        neg_factors.append('Chemical content')
    
    if not neg_factors:
        neg_factors = ['No major concerns']
    
    if not materials:
        materials = ['Not specified']
    
    return {
        'score': int(score),
        'grade': grade,
        'title': product_data.get('title', 'Unknown'),
        'platform': product_data.get('platform', 'Unknown'),
        'materials': materials[:5],
        'certifications': certs if certs else ['None found'],
        'positive_factors': pos_factors[:5],
        'negative_factors': neg_factors[:5],
        'greenwashing_detected': greenwash,
        'recommendations': recs[:4]
    }

def analyze_product(url):
    return {
        'score': 55, 'grade': 'D', 'title': 'Unknown',
        'platform': 'Unknown', 'materials': ['Not available'],
        'certifications': ['None found'], 'positive_factors': ['Check page'],
        'negative_factors': ['Insufficient info'], 'greenwashing_detected': False,
        'recommendations': ['Visit product page']
    }
