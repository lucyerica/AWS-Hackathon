import json
import boto3
import base64
import os
from datetime import datetime, timedelta
from decimal import Decimal
from collections import defaultdict

rekognition = boto3.client('rekognition')
bedrock = boto3.client('bedrock-runtime')
dynamodb = boto3.resource('dynamodb')
s3 = boto3.client('s3')

TABLE_NAME = os.environ.get('DYNAMODB_TABLE', 'NutriSnapMeals')
BUCKET_NAME = os.environ.get('S3_BUCKET', 'nutrisnap-images')

table = dynamodb.Table(TABLE_NAME)

DAILY_REQUIREMENTS = {
    'vitaminC': 90, 'vitaminD': 20, 'calcium': 1000, 'iron': 18,
    'omega3': 1.6, 'fiber': 25, 'protein': 50, 'potassium': 3500
}

def lambda_handler(event, context):
    try:
        body = json.loads(event['body'])
        action = body.get('action', 'analyze')
        
        if action == 'analyze':
            return analyze_meal(body)
        elif action == 'submit_feeling':
            return submit_feeling(body)
        elif action == 'get_ml_insights':
            return get_ml_insights(body)
        else:
            return error_response('Invalid action')
    except Exception as e:
        return error_response(str(e))

def analyze_meal(body):
    image_base64 = body['image']
    user_id = body.get('user_id', 'demo_user')
    
    image_bytes = base64.b64decode(image_base64.split(',')[1] if ',' in image_base64 else image_base64)
    
    timestamp = datetime.now().isoformat()
    s3_key = f"meals/{user_id}/{timestamp}.jpg"
    s3.put_object(Bucket=BUCKET_NAME, Key=s3_key, Body=image_bytes, ContentType='image/jpeg')
    image_url = f"https://{BUCKET_NAME}.s3.amazonaws.com/{s3_key}"
    
    rekognition_response = rekognition.detect_labels(
        Image={'Bytes': image_bytes},
        MaxLabels=15,
        MinConfidence=65
    )
    
    food_labels = []
    for label in rekognition_response['Labels']:
        if is_food_related(label['Name']):
            food_labels.append({
                'name': label['Name'],
                'confidence': round(label['Confidence'], 2),
                'category': categorize_food(label['Name'])
            })
    
    nutrition_prompt = f"""Analyze meal: {', '.join([f['name'] for f in food_labels])}.

Return JSON:
{{
  "nutrition": {{"calories": <num>, "protein": <g>, "carbs": <g>, "fat": <g>, "fiber": <g>, "sugar": <g>, "vitaminC": <mg>, "iron": <mg>, "calcium": <mg>, "omega3": <g>, "potassium": <mg>}},
  "insights": [<3 tips>],
  "micronutrients_present": [<list>]
}}"""

    bedrock_response = bedrock.invoke_model(
        modelId='anthropic.claude-3-5-haiku-20241022-v1:0',
        body=json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1500,
            "messages": [{"role": "user", "content": nutrition_prompt}]
        })
    )
    
    response_body = json.loads(bedrock_response['body'].read())
    ai_analysis = json.loads(response_body['content'][0]['text'])
    
    meal_item = {
        'user_id': user_id,
        'meal_id': timestamp,
        'timestamp': timestamp,
        'image_url': image_url,
        's3_key': s3_key,
        'detected_foods': food_labels,
        'nutrition': convert_to_decimal(ai_analysis['nutrition']),
        'insights': ai_analysis['insights'],
        'micronutrients': ai_analysis.get('micronutrients_present', []),
        'feeling': None,
        'symptoms': [],
        'created_at': datetime.now().isoformat()
    }
    
    table.put_item(Item=meal_item)
    
    return success_response({
        'meal_id': timestamp,
        'image_url': image_url,
        'foods': food_labels,
        'nutrition': ai_analysis['nutrition'],
        'insights': ai_analysis['insights']
    })

def submit_feeling(body):
    user_id = body.get('user_id', 'demo_user')
    meal_id = body['meal_id']
    feeling = body['feeling']
    symptoms = body.get('symptoms', [])
    
    table.update_item(
        Key={'user_id': user_id, 'meal_id': meal_id},
        UpdateExpression='SET feeling = :f, symptoms = :s, feeling_timestamp = :ft',
        ExpressionAttributeValues={
            ':f': feeling,
            ':s': symptoms,
            ':ft': datetime.now().isoformat()
        }
    )
    
    return success_response({'message': 'Feeling recorded'})

def get_ml_insights(body):
    user_id = body.get('user_id', 'demo_user')
    days = body.get('days', 7)
    
    meals = get_user_meals(user_id, days=days)
    
    intolerances = detect_food_intolerances(meals)
    nutritional_gaps = analyze_nutritional_gaps(meals, days)
    predictions = generate_predictions(meals)
    weekly_trends = calculate_weekly_trends(meals)
    
    return success_response({
        'intolerances': intolerances,
        'nutritional_gaps': nutritional_gaps,
        'predictions': predictions,
        'weekly_trends': weekly_trends
    })

def detect_food_intolerances(meals):
    food_feelings = defaultdict(list)
    
    for meal in meals:
        if meal.get('feeling') is not None:
            for food in meal.get('detected_foods', []):
                food_name = food['name']
                food_feelings[food_name].append({
                    'feeling': meal['feeling'],
                    'symptoms': meal.get('symptoms', []),
                    'timestamp': meal['timestamp']
                })
    
    intolerances = []
    for food, feelings in food_feelings.items():
        if len(feelings) < 3:
            continue
        
        negative_reactions = sum(1 for f in feelings if f['feeling'] <= 2)
        total_reactions = len(feelings)
        
        if total_reactions > 0:
            negative_rate = negative_reactions / total_reactions
            
            if negative_rate >= 0.6:
                confidence = min(int(negative_rate * 100), 95)
                
                all_symptoms = [s for f in feelings for s in f['symptoms']]
                symptom_counts = defaultdict(int)
                for symptom in all_symptoms:
                    symptom_counts[symptom] += 1
                
                common_symptoms = [s for s, count in symptom_counts.items() if count >= 2]
                
                intolerances.append({
                    'food': food,
                    'confidence': confidence,
                    'pattern': f'Negative symptoms {negative_reactions}/{total_reactions} times',
                    'recommendation': get_intolerance_recommendation(food, common_symptoms),
                    'common_symptoms': common_symptoms
                })
    
    intolerances.sort(key=lambda x: x['confidence'], reverse=True)
    return intolerances[:5]

def analyze_nutritional_gaps(meals, days):
    daily_totals = defaultdict(lambda: defaultdict(float))
    
    for meal in meals:
        date = meal['timestamp'].split('T')[0]
        nutrition = meal.get('nutrition', {})
        
        for nutrient, value in nutrition.items():
            if nutrient in DAILY_REQUIREMENTS:
                daily_totals[date][nutrient] += float(value)
    
    gaps = []
    for nutrient, required_amount in DAILY_REQUIREMENTS.items():
        deficient_days = 0
        
        for date in daily_totals:
            if daily_totals[date].get(nutrient, 0) < required_amount * 0.7:
                deficient_days += 1
        
        if deficient_days >= 2:
            severity = 'high' if deficient_days >= 4 else 'medium' if deficient_days >= 3 else 'low'
            
            gaps.append({
                'nutrient': format_nutrient_name(nutrient),
                'severity': severity,
                'daysDeficient': deficient_days,
                'recommendation': get_nutrient_recommendation(nutrient),
                'targetFoods': get_foods_high_in_nutrient(nutrient)
            })
    
    severity_order = {'high': 0, 'medium': 1, 'low': 2}
    gaps.sort(key=lambda x: severity_order[x['severity']])
    return gaps

def generate_predictions(meals):
    if len(meals) < 3:
        return {'energyLevel': 7, 'nextMealTiming': '3-4 hours', 'optimalNextMeal': 'Balanced meal', 'sleepQuality': 'Track more meals'}
    
    recent_meals = meals[:5]
    avg_protein = sum(float(m.get('nutrition', {}).get('protein', 0)) for m in recent_meals) / len(recent_meals)
    avg_carbs = sum(float(m.get('nutrition', {}).get('carbs', 0)) for m in recent_meals) / len(recent_meals)
    
    energy_level = 7 if avg_protein > 30 and avg_carbs > 40 else 5
    
    if len(meals) >= 2:
        time_diffs = []
        for i in range(len(meals) - 1):
            t1 = datetime.fromisoformat(meals[i]['timestamp'])
            t2 = datetime.fromisoformat(meals[i + 1]['timestamp'])
            diff = abs((t1 - t2).total_seconds() / 3600)
            if diff < 12:
                time_diffs.append(diff)
        
        avg_gap = sum(time_diffs) / len(time_diffs) if time_diffs else 4
        next_meal_timing = f"{avg_gap:.1f} hours"
    else:
        next_meal_timing = "3.5 hours"
    
    if avg_protein < 25:
        optimal_next_meal = "High protein, moderate carbs"
    elif avg_carbs < 30:
        optimal_next_meal = "Balanced with complex carbs"
    else:
        optimal_next_meal = "Light meal with vegetables"
    
    last_meal = meals[0] if meals else None
    if last_meal:
        sugar = float(last_meal.get('nutrition', {}).get('sugar', 0))
        sleep_quality = "Good - balanced macros" if sugar < 15 else "May affect sleep - high sugar"
    else:
        sleep_quality = "Good - balanced macros"
    
    return {
        'energyLevel': energy_level,
        'nextMealTiming': next_meal_timing,
        'optimalNextMeal': optimal_next_meal,
        'sleepQuality': sleep_quality
    }

def calculate_weekly_trends(meals):
    if not meals:
        return {'avgCalories': 0, 'proteinTrend': 'tracking', 'moodScore': 7.0, 'digestiveHealth': 'tracking'}
    
    total_calories = sum(float(m.get('nutrition', {}).get('calories', 0)) for m in meals)
    avg_calories = int(total_calories / max(len(meals), 1))
    
    if len(meals) >= 4:
        first_half_protein = sum(float(m.get('nutrition', {}).get('protein', 0)) for m in meals[len(meals)//2:])
        second_half_protein = sum(float(m.get('nutrition', {}).get('protein', 0)) for m in meals[:len(meals)//2])
        protein_trend = "increasing" if second_half_protein > first_half_protein else "stable"
    else:
        protein_trend = "stable"
    
    feelings = [m.get('feeling') for m in meals if m.get('feeling') is not None]
    mood_score = sum(feelings) / len(feelings) if feelings else 7.0
    
    all_symptoms = [s for m in meals for s in m.get('symptoms', [])]
    digestive_symptoms = ['Bloating', 'Gas', 'Nausea', 'Stomach Pain']
    digestive_issues = sum(1 for s in all_symptoms if s in digestive_symptoms)
    
    if digestive_issues == 0:
        digestive_health = "excellent"
    elif digestive_issues < 3:
        digestive_health = "improving"
    else:
        digestive_health = "needs attention"
    
    return {
        'avgCalories': avg_calories,
        'proteinTrend': protein_trend,
        'moodScore': round(mood_score, 1),
        'digestiveHealth': digestive_health
    }

def get_user_meals(user_id, days=7):
    cutoff_date = (datetime.now() - timedelta(days=days)).isoformat()
    response = table.query(
        KeyConditionExpression='user_id = :uid AND meal_id >= :cutoff',
        ExpressionAttributeValues={':uid': user_id, ':cutoff': cutoff_date},
        ScanIndexForward=False,
        Limit=100
    )
    return response['Items']

def is_food_related(label):
    keywords = ['food', 'meal', 'dish', 'chicken', 'beef', 'fish', 'rice', 'pasta', 'bread', 'vegetable', 'fruit', 'salad']
    return any(k in label.lower() for k in keywords)

def categorize_food(food_name):
    f = food_name.lower()
    if any(w in f for w in ['chicken', 'beef', 'fish', 'egg']): return 'protein'
    if any(w in f for w in ['rice', 'pasta', 'bread']): return 'grains'
    if any(w in f for w in ['vegetable', 'broccoli', 'salad']): return 'vegetables'
    if any(w in f for w in ['fruit', 'apple', 'banana']): return 'fruits'
    if any(w in f for w in ['milk', 'cheese', 'yogurt']): return 'dairy'
    return 'other'

def get_intolerance_recommendation(food, symptoms):
    f = food.lower()
    if 'dairy' in f or 'milk' in f: return "Try lactose-free alternatives"
    if 'wheat' in f or 'bread' in f: return "Try gluten-free options"
    return f"Consider eliminating {food} for 2 weeks"

def format_nutrient_name(nutrient):
    names = {'vitaminC': 'Vitamin C', 'vitaminD': 'Vitamin D', 'omega3': 'Omega-3', 'fiber': 'Fiber'}
    return names.get(nutrient, nutrient.capitalize())

def get_nutrient_recommendation(nutrient):
    recs = {
        'vitaminC': 'Add citrus fruits or bell peppers',
        'omega3': 'Include fatty fish or walnuts',
        'fiber': 'Increase whole grains and vegetables'
    }
    return recs.get(nutrient, 'Diversify your diet')

def get_foods_high_in_nutrient(nutrient):
    foods = {
        'vitaminC': ['Oranges', 'Strawberries', 'Bell Peppers'],
        'omega3': ['Salmon', 'Walnuts', 'Chia Seeds'],
        'fiber': ['Oats', 'Lentils', 'Broccoli']
    }
    return foods.get(nutrient, ['Whole Foods', 'Vegetables'])

def convert_to_decimal(obj):
    if isinstance(obj, list):
        return [convert_to_decimal(item) for item in obj]
    elif isinstance(obj, dict):
        return {key: convert_to_decimal(value) for key, value in obj.items()}
    elif isinstance(obj, float):
        return Decimal(str(obj))
    return obj

def success_response(data):
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'success': True, 'data': data})
    }

def error_response(message):
    return {
        'statusCode': 500,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'success': False, 'error': message})
    }