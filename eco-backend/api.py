"""
ECO-SCORE BACKEND API - api.py
Save this file as: eco-backend/api.py

This is your Python Flask backend that analyzes product eco-friendliness.
It works with your Chrome extension to provide eco scores.
"""

from flask import Flask, request, jsonify
from scraper import analyze_product, calculate_eco_score
import logging

app = Flask(__name__)

# Add CORS manually
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@app.route('/api/eco-score', methods=['POST', 'OPTIONS'])
def get_eco_score():
    """
    Main API endpoint that analyzes product eco-friendliness
    
    Expected JSON input:
    {
        "url": "product_url",
        "text": "page_text",
        "title": "product_title",
        "platform": "amazon" or "flipkart"
    }
    
    Returns eco score (0-100), grade (A-F), and detailed analysis
    """
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        data        = request.get_json()
        product_url = data.get('url', '')
        page_text   = data.get('text', '')
        page_title  = data.get('title', '')
        platform    = data.get('platform', '')

        if not product_url:
            return jsonify({'error': 'Product URL is required'}), 400

        logger.info(f"Platform: {platform} | Title: {page_title[:50]}")
        logger.info(f"Text length received: {len(page_text)} chars")

        # If browser sent us the text, use it directly (skip Python scraping)
        if page_text and len(page_text) > 100:
            logger.info("Using browser-extracted text directly")
            product_data = {
                'title':    page_title or 'Unknown Product',
                'text':     page_text,
                'url':      product_url,
                'platform': platform.title()
            }
            result = calculate_eco_score(product_data)
        else:
            # Fallback to Python scraping
            logger.info("Browser text not available, using Python scraper")
            result = analyze_product(product_url)

        response = {
            'eco_score': result['score'],
            'grade':     result['grade'],
            'details': {
                'product_name':          result.get('title', 'Unknown Product'),
                'platform':              result.get('platform', platform),
                'materials':             result.get('materials', []),
                'certifications':        result.get('certifications', []),
                'positive_factors':      result.get('positive_factors', []),
                'negative_factors':      result.get('negative_factors', []),
                'greenwashing_detected': any(
                    'greenwashing' in f.lower()
                    for f in result.get('negative_factors', [])
                ),
                'recommendations': result.get('recommendations', [])
            }
        }

        logger.info(f"Score: {result['score']}/100 | Grade: {result['grade']}")
        return jsonify(response), 200

    except Exception as e:
        logger.error(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint to verify backend is running"""
    return jsonify({'status': 'healthy', 'message': 'Eco-Score API is running'}), 200


@app.route('/', methods=['GET'])
def home():
    """Home endpoint with version info"""
    return jsonify({'name': 'Eco-Score API', 'version': '2.0', 'status': 'running'}), 200


if __name__ == '__main__':
    print("🌱 Starting Eco-Score Backend Server...")
    print("📍 Server running on http://localhost:5000")
    print("✅ Ready to analyze Amazon & Flipkart products!")
    app.run(debug=True, port=5000, host='0.0.0.0')
