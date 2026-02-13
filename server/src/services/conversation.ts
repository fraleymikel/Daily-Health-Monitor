import { getDb } from '../models/database';
import { fetchWeatherForDate, WeatherData } from './weather';

export interface ConversationQuestion {
  id: string;
  category: string;
  text: string;
  type: 'scale' | 'text' | 'choice' | 'number';
  options?: string[];
  followUp?: boolean;
  condition?: (responses: Record<string, string>) => boolean;
}

// The conversational flow - questions are asked one at a time in a natural order
const QUESTION_FLOW: ConversationQuestion[] = [
  {
    id: 'greeting',
    category: 'mood',
    text: "Hey! How are you feeling today, overall?",
    type: 'choice',
    options: ['Great', 'Good', 'Okay', 'Not great', 'Rough'],
  },
  {
    id: 'mood_detail',
    category: 'mood',
    text: "Got it. Anything specific driving that feeling?",
    type: 'text',
  },
  {
    id: 'sleep_quality',
    category: 'sleep',
    text: "How did you sleep last night?",
    type: 'choice',
    options: ['Amazing', 'Well', 'Okay', 'Poorly', 'Terrible'],
  },
  {
    id: 'sleep_hours',
    category: 'sleep',
    text: "About how many hours of sleep did you get?",
    type: 'number',
  },
  {
    id: 'sleep_notes',
    category: 'sleep',
    text: "Any trouble falling asleep, waking up during the night, or vivid dreams?",
    type: 'text',
  },
  {
    id: 'energy',
    category: 'energy',
    text: "How's your energy level right now? (1 = exhausted, 10 = unstoppable)",
    type: 'scale',
  },
  {
    id: 'meals',
    category: 'nutrition',
    text: "What have you eaten today? Just a quick rundown is fine.",
    type: 'text',
  },
  {
    id: 'meal_quality',
    category: 'nutrition',
    text: "How would you rate how well you ate today?",
    type: 'choice',
    options: ['Very healthy', 'Mostly healthy', 'Mixed', 'Mostly unhealthy', 'Junk food day'],
  },
  {
    id: 'water',
    category: 'hydration',
    text: "How much water have you had today? (glasses or bottles)",
    type: 'number',
  },
  {
    id: 'caffeine',
    category: 'hydration',
    text: "Any caffeine or alcohol today? What and how much?",
    type: 'text',
  },
  {
    id: 'exercise',
    category: 'exercise',
    text: "Did you get any movement or exercise in today?",
    type: 'text',
  },
  {
    id: 'pain',
    category: 'physical',
    text: "Any physical pain or discomfort today? If so, where and how bad (1-10)?",
    type: 'text',
  },
  {
    id: 'stress',
    category: 'mental',
    text: "How's your stress level? (1 = zen, 10 = overwhelmed)",
    type: 'scale',
  },
  {
    id: 'social',
    category: 'social',
    text: "Any notable interactions with people today - positive or negative?",
    type: 'text',
  },
  {
    id: 'screen_time',
    category: 'lifestyle',
    text: "Roughly how much screen time today (hours)?",
    type: 'number',
  },
  {
    id: 'outdoors',
    category: 'lifestyle',
    text: "Did you spend any time outdoors today?",
    type: 'choice',
    options: ['Yes, a lot', 'Some', 'A little', 'Not really'],
  },
  {
    id: 'cycle_day',
    category: 'hormonal',
    text: "What day of your cycle are you on? (or skip if not applicable)",
    type: 'number',
    condition: (responses) => {
      // Only ask if cycle tracking is enabled (checked at runtime)
      return true; // Controlled by settings check in the route
    },
  },
  {
    id: 'gratitude',
    category: 'mental',
    text: "One thing you're grateful for today?",
    type: 'text',
  },
  {
    id: 'anything_else',
    category: 'general',
    text: "Anything else on your mind or worth noting about today?",
    type: 'text',
  },
];

export function getQuestionFlow(includeCycleTracking: boolean): ConversationQuestion[] {
  if (!includeCycleTracking) {
    return QUESTION_FLOW.filter(q => q.id !== 'cycle_day');
  }
  return [...QUESTION_FLOW];
}

export function getNextQuestion(
  answeredIds: string[],
  includeCycleTracking: boolean
): ConversationQuestion | null {
  const flow = getQuestionFlow(includeCycleTracking);
  for (const q of flow) {
    if (!answeredIds.includes(q.id)) {
      return q;
    }
  }
  return null;
}

function moodToNumber(mood: string): number {
  const map: Record<string, number> = {
    'great': 9, 'good': 7, 'okay': 5, 'not great': 3, 'rough': 1,
    'amazing': 9, 'well': 7, 'poorly': 3, 'terrible': 1,
    'very healthy': 9, 'mostly healthy': 7, 'mixed': 5, 'mostly unhealthy': 3, 'junk food day': 1,
    'yes, a lot': 9, 'some': 6, 'a little': 3, 'not really': 1,
  };
  return map[mood.toLowerCase()] ?? 5;
}

export function extractMetrics(
  responses: Array<{ id: string; category: string; answer: string }>
): Array<{ category: string; metric_name: string; numeric_value: number | null; text_value: string }> {
  const metrics: Array<{ category: string; metric_name: string; numeric_value: number | null; text_value: string }> = [];

  for (const r of responses) {
    switch (r.id) {
      case 'greeting':
        metrics.push({ category: 'mood', metric_name: 'overall_mood', numeric_value: moodToNumber(r.answer), text_value: r.answer });
        break;
      case 'sleep_quality':
        metrics.push({ category: 'sleep', metric_name: 'sleep_quality', numeric_value: moodToNumber(r.answer), text_value: r.answer });
        break;
      case 'sleep_hours':
        metrics.push({ category: 'sleep', metric_name: 'sleep_hours', numeric_value: parseFloat(r.answer) || null, text_value: r.answer });
        break;
      case 'energy':
        metrics.push({ category: 'energy', metric_name: 'energy_level', numeric_value: parseFloat(r.answer) || null, text_value: r.answer });
        break;
      case 'meal_quality':
        metrics.push({ category: 'nutrition', metric_name: 'meal_quality', numeric_value: moodToNumber(r.answer), text_value: r.answer });
        break;
      case 'water':
        metrics.push({ category: 'hydration', metric_name: 'water_intake', numeric_value: parseFloat(r.answer) || null, text_value: r.answer });
        break;
      case 'stress':
        metrics.push({ category: 'mental', metric_name: 'stress_level', numeric_value: parseFloat(r.answer) || null, text_value: r.answer });
        break;
      case 'screen_time':
        metrics.push({ category: 'lifestyle', metric_name: 'screen_time', numeric_value: parseFloat(r.answer) || null, text_value: r.answer });
        break;
      case 'outdoors':
        metrics.push({ category: 'lifestyle', metric_name: 'outdoor_time', numeric_value: moodToNumber(r.answer), text_value: r.answer });
        break;
      case 'cycle_day':
        metrics.push({ category: 'hormonal', metric_name: 'cycle_day', numeric_value: parseFloat(r.answer) || null, text_value: r.answer });
        break;
    }
    // Always store text responses for pattern mining
    if (['mood_detail', 'sleep_notes', 'meals', 'caffeine', 'exercise', 'pain', 'social', 'gratitude', 'anything_else'].includes(r.id)) {
      metrics.push({ category: r.category, metric_name: r.id, numeric_value: null, text_value: r.answer });
    }
  }

  return metrics;
}

export function generateClosingMessage(
  responses: Array<{ id: string; category: string; answer: string }>,
  weather: WeatherData | null
): string {
  const mood = responses.find(r => r.id === 'greeting')?.answer?.toLowerCase() || '';
  const energy = parseFloat(responses.find(r => r.id === 'energy')?.answer || '5');
  const water = parseFloat(responses.find(r => r.id === 'water')?.answer || '0');
  const stress = parseFloat(responses.find(r => r.id === 'stress')?.answer || '5');

  const parts: string[] = [];

  parts.push("Thanks for checking in today!");

  // Mood-aware response
  if (['great', 'good'].includes(mood)) {
    parts.push("Glad to hear you're doing well.");
  } else if (['not great', 'rough'].includes(mood)) {
    parts.push("Sorry to hear today has been tough. Remember, every day is a fresh start.");
  }

  // Weather context
  if (weather) {
    parts.push(`Today's weather: ${weather.weather_description}, high of ${Math.round(weather.temperature_high)}°F.`);
  }

  // Quick observations
  if (water < 4) {
    parts.push("Looks like you could use a bit more water - try to get a couple more glasses in before bed.");
  }
  if (energy <= 3) {
    parts.push("Your energy is pretty low today. Make sure you're taking breaks and being kind to yourself.");
  }
  if (stress >= 8) {
    parts.push("Stress is running high. Even 5 minutes of deep breathing or a short walk can help take the edge off.");
  }

  parts.push("See you tomorrow! 💙");

  return parts.join(' ');
}
