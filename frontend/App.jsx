import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Loader2, TrendingUp, Apple, Flame, Droplet, AlertCircle, Brain, Sparkles, LineChart } from 'lucide-react';

const NutriSnap = () => {
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [mealHistory, setMealHistory] = useState([]);
  const [showFeelingPrompt, setShowFeelingPrompt] = useState(false);
  const [selectedMealForFeeling, setSelectedMealForFeeling] = useState(null);
  const [mlInsights, setMlInsights] = useState(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Simulated AWS ML insights
  useEffect(() => {
    if (mealHistory.length >= 3) {
      generateMLInsights();
    }
  }, [mealHistory]);

  const generateMLInsights = () => {
    // Simulated SageMaker predictions
    const insights = {
      intolerances: [
        {
          food: 'Dairy Products',
          confidence: 78,
          pattern: 'Negative symptoms reported 4/5 times after consuming dairy',
          recommendation: 'Consider lactose-free alternatives'
        },
        {
          food: 'Gluten',
          confidence: 45,
          pattern: 'Mild digestive discomfort observed',
          recommendation: 'Monitor gluten intake for another week'
        }
      ],
      nutritionalGaps: [
        {
          nutrient: 'Vitamin C',
          severity: 'high',
          daysDeficient: 4,
          recommendation: 'Add citrus fruits, bell peppers, or broccoli',
          targetFoods: ['Oranges', 'Strawberries', 'Bell Peppers']
        },
        {
          nutrient: 'Omega-3',
          severity: 'medium',
          daysDeficient: 3,
          recommendation: 'Include fatty fish or walnuts',
          targetFoods: ['Salmon', 'Sardines', 'Chia Seeds']
        },
        {
          nutrient: 'Fiber',
          severity: 'low',
          daysDeficient: 2,
          recommendation: 'Increase whole grains and vegetables',
          targetFoods: ['Oats', 'Lentils', 'Brussels Sprouts']
        }
      ],
      predictions: {
        energyLevel: 7,
        nextMealTiming: '3.5 hours',
        optimalNextMeal: 'High protein, moderate carbs',
        sleepQuality: 'Good - balanced macros detected'
      },
      weeklyTrends: {
        avgCalories: 1850,
        proteinTrend: 'increasing',
        moodScore: 7.2,
        digestiveHealth: 'improving'
      }
    };
    
    setMlInsights(insights);
  };

  const analyzeMeal = async (imageFile) => {
    setAnalyzing(true);
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    const foods = [
      { name: 'Grilled Chicken Breast', confidence: 95, category: 'protein' },
      { name: 'Brown Rice', confidence: 89, category: 'grains' },
      { name: 'Steamed Broccoli', confidence: 92, category: 'vegetables' },
      { name: 'Olive Oil', confidence: 78, category: 'fats' }
    ];
    
    const nutrition = {
      calories: 520,
      protein: 45,
      carbs: 52,
      fat: 12,
      fiber: 8,
      sugar: 3,
      vitaminC: 85,
      iron: 3.2,
      calcium: 120
    };
    
    const insights = [
      'Great protein-to-carb ratio for post-workout!',
      'High in fiber - excellent for digestion',
      'Good source of Vitamin C from broccoli'
    ];
    
    const newResult = {
      foods,
      nutrition,
      insights,
      timestamp: new Date().toISOString(),
      imageUrl: imagePreview,
      mealId: Date.now()
    };
    
    setResult(newResult);
    setAnalyzing(false);
    
    // Prompt for feeling after 2 hours (simulated immediately for demo)
    setTimeout(() => {
      setSelectedMealForFeeling(newResult);
      setShowFeelingPrompt(true);
    }, 3000);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        analyzeMeal(file);
      };
      reader.readAsDataURL(file);
    }
  };

  const submitFeeling = (feeling, symptoms) => {
    const updatedMeal = {
      ...selectedMealForFeeling,
      feeling,
      symptoms,
      feelingTimestamp: new Date().toISOString()
    };
    
    setMealHistory(prev => [updatedMeal, ...prev].slice(0, 10));
    setShowFeelingPrompt(false);
    setSelectedMealForFeeling(null);
  };

  const resetAnalysis = () => {
    setImage(null);
    setImagePreview(null);
    setResult(null);
    setAnalyzing(false);
  };

  const FeelingPrompt = () => {
    const [selectedFeeling, setSelectedFeeling] = useState(null);
    const [selectedSymptoms, setSelectedSymptoms] = useState([]);
    
    const feelings = [
      { value: 5, label: '😊 Great', color: 'bg-green-500' },
      { value: 4, label: '🙂 Good', color: 'bg-green-400' },
      { value: 3, label: '😐 Okay', color: 'bg-yellow-500' },
      { value: 2, label: '😕 Not Great', color: 'bg-orange-500' },
      { value: 1, label: '😣 Bad', color: 'bg-red-500' }
    ];
    
    const symptoms = [
      'Bloating', 'Gas', 'Nausea', 'Stomach Pain', 
      'Headache', 'Fatigue', 'Brain Fog', 'Skin Issues'
    ];
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-6 h-6 text-purple-600" />
            <h3 className="text-xl font-bold text-gray-800">How do you feel?</h3>
          </div>
          <p className="text-gray-600 mb-4 text-sm">
            2 hours after eating. This helps our AI detect food intolerances!
          </p>
          
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-5 gap-2">
              {feelings.map((feeling) => (
                <button
                  key={feeling.value}
                  onClick={() => setSelectedFeeling(feeling.value)}
                  className={`p-3 rounded-xl text-center transition-all ${
                    selectedFeeling === feeling.value
                      ? `${feeling.color} text-white scale-110 shadow-lg`
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  <div className="text-2xl mb-1">{feeling.label.split(' ')[0]}</div>
                  <div className="text-xs font-medium">{feeling.label.split(' ')[1]}</div>
                </button>
              ))}
            </div>
            
            {selectedFeeling && selectedFeeling < 4 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Any symptoms? (Optional)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {symptoms.map((symptom) => (
                    <button
                      key={symptom}
                      onClick={() => {
                        if (selectedSymptoms.includes(symptom)) {
                          setSelectedSymptoms(selectedSymptoms.filter(s => s !== symptom));
                        } else {
                          setSelectedSymptoms([...selectedSymptoms, symptom]);
                        }
                      }}
                      className={`px-3 py-2 rounded-lg text-sm transition-all ${
                        selectedSymptoms.includes(symptom)
                          ? 'bg-red-100 border-2 border-red-500 text-red-700'
                          : 'bg-gray-100 border-2 border-transparent hover:bg-gray-200'
                      }`}
                    >
                      {symptom}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => setShowFeelingPrompt(false)}
              className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-medium"
            >
              Skip
            </button>
            <button
              onClick={() => submitFeeling(selectedFeeling, selectedSymptoms)}
              disabled={!selectedFeeling}
              className="flex-1 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-green-50 p-4">
      {showFeelingPrompt && <FeelingPrompt />}
      
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8 pt-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Brain className="w-10 h-10 text-purple-600" />
            <h1 className="text-4xl font-bold text-gray-800">NutriSnap AI</h1>
          </div>
          <p className="text-gray-600">ML-Powered Food Intolerance Detection & Nutrition Tracking</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Analysis Panel */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              {!imagePreview ? (
                <div className="text-center py-12">
                  <Camera className="w-20 h-20 mx-auto text-gray-300 mb-4" />
                  <h2 className="text-2xl font-semibold text-gray-700 mb-2">Snap Your Meal</h2>
                  <p className="text-gray-500 mb-6">AI will analyze nutrition & track patterns</p>
                  
                  <div className="flex gap-4 justify-center">
                    <button
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-medium"
                    >
                      <Camera className="w-5 h-5" />
                      Take Photo
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
                    >
                      <Upload className="w-5 h-5" />
                      Upload Image
                    </button>
                  </div>
                  
                  <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileSelect} className="hidden" />
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                </div>
              ) : (
                <div>
                  <div className="mb-6">
                    <img src={imagePreview} alt="Meal" className="w-full h-64 object-cover rounded-xl" />
                  </div>

                  {analyzing ? (
                    <div className="text-center py-8">
                      <Loader2 className="w-12 h-12 animate-spin mx-auto text-purple-600 mb-4" />
                      <p className="text-gray-600 font-medium">Analyzing with AWS ML...</p>
                      <p className="text-sm text-gray-500 mt-2">Rekognition + Bedrock + SageMaker</p>
                    </div>
                  ) : result ? (
                    <div>
                      <div className="mb-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-3">Detected Foods</h3>
                        <div className="grid grid-cols-2 gap-3">
                          {result.foods.map((food, idx) => (
                            <div key={idx} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                              <div className="font-medium text-gray-800">{food.name}</div>
                              <div className="text-xs text-gray-500">{food.category} • {food.confidence}%</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mb-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-3">Nutritional Breakdown</h3>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                            <Flame className="w-6 h-6 text-orange-600 mb-2" />
                            <div className="text-2xl font-bold text-gray-800">{result.nutrition.calories}</div>
                            <div className="text-sm text-gray-600">Calories</div>
                          </div>
                          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                            <TrendingUp className="w-6 h-6 text-blue-600 mb-2" />
                            <div className="text-2xl font-bold text-gray-800">{result.nutrition.protein}g</div>
                            <div className="text-sm text-gray-600">Protein</div>
                          </div>
                          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                            <Droplet className="w-6 h-6 text-green-600 mb-2" />
                            <div className="text-2xl font-bold text-gray-800">{result.nutrition.carbs}g</div>
                            <div className="text-sm text-gray-600">Carbs</div>
                          </div>
                        </div>
                      </div>

                      <button onClick={resetAnalysis} className="w-full py-3 bg-gray-800 text-white rounded-xl hover:bg-gray-900 transition-colors font-medium">
                        Analyze Another Meal
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* ML Insights Panel */}
            {mlInsights && (
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl shadow-lg p-6 text-white">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-6 h-6" />
                  <h3 className="text-xl font-bold">AWS ML Insights</h3>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-white bg-opacity-20 rounded-xl p-4 backdrop-blur">
                    <div className="font-semibold mb-2">🔮 Energy Prediction</div>
                    <div className="text-2xl font-bold">{mlInsights.predictions.energyLevel}/10</div>
                    <div className="text-sm opacity-90">Expected in next 2 hours</div>
                  </div>
                  
                  <div className="bg-white bg-opacity-20 rounded-xl p-4 backdrop-blur">
                    <div className="font-semibold mb-2">⏰ Next Meal</div>
                    <div className="text-2xl font-bold">{mlInsights.predictions.nextMealTiming}</div>
                    <div className="text-sm opacity-90">Optimal timing</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Intolerance Detection */}
            {mlInsights && mlInsights.intolerances.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <h3 className="text-lg font-semibold text-gray-800">Potential Intolerances</h3>
                </div>
                <div className="space-y-3">
                  {mlInsights.intolerances.map((intolerance, idx) => (
                    <div key={idx} className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-semibold text-gray-800">{intolerance.food}</div>
                        <div className="text-sm font-bold text-red-600">{intolerance.confidence}%</div>
                      </div>
                      <div className="text-sm text-gray-600 mb-2">{intolerance.pattern}</div>
                      <div className="text-xs text-gray-500 italic">💡 {intolerance.recommendation}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
                  <strong>Powered by AWS SageMaker:</strong> Pattern recognition trained on your meal history and symptoms
                </div>
              </div>
            )}

            {/* Nutritional Gaps */}
            {mlInsights && mlInsights.nutritionalGaps.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <LineChart className="w-5 h-5 text-orange-600" />
                  <h3 className="text-lg font-semibold text-gray-800">Nutritional Gaps</h3>
                </div>
                <div className="space-y-3">
                  {mlInsights.nutritionalGaps.map((gap, idx) => (
                    <div key={idx} className={`rounded-lg p-4 border-2 ${
                      gap.severity === 'high' ? 'bg-red-50 border-red-300' :
                      gap.severity === 'medium' ? 'bg-orange-50 border-orange-300' :
                      'bg-yellow-50 border-yellow-300'
                    }`}>
                      <div className="font-semibold text-gray-800 mb-1">{gap.nutrient}</div>
                      <div className="text-xs text-gray-600 mb-2">Deficient for {gap.daysDeficient} days</div>
                      <div className="text-sm text-gray-700 mb-2">{gap.recommendation}</div>
                      <div className="flex flex-wrap gap-1">
                        {gap.targetFoods.map((food, i) => (
                          <span key={i} className="text-xs bg-white px-2 py-1 rounded-full font-medium text-gray-700">
                            {food}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Meal History */}
            {mealHistory.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Meals</h3>
                <div className="space-y-3">
                  {mealHistory.slice(0, 3).map((meal, idx) => (
                    <div key={idx} className="flex gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <img src={meal.imageUrl} alt="Meal" className="w-16 h-16 rounded-lg object-cover" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{meal.foods[0]?.name}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(meal.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {meal.feeling && (
                          <div className="text-xs font-semibold text-purple-600 mt-1">
                            Feeling: {['😣', '😕', '😐', '🙂', '😊'][meal.feeling - 1]}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NutriSnap;