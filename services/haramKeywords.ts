
import { HalalStatus, IngredientDetail } from "../types";

// List of common Haram ingredients and E-numbers
// This acts as a lightweight local database
const HARAM_KEYWORDS = [
  // E-Numbers (Definite Haram or highly doubtful derived from animal)
  "e120", "e441", "e542", "e904", "e920", "e921", "e471",
  
  // English Keywords
  "pork", "lard", "bacon", "ham", "gelatin", "gelatine", 
  "alcohol", "ethanol", "wine", "beer", "rum", "carmine", "cochineal",
  "shellac", "l-cysteine", "rennet", "pepsin",
  
  // Arabic Keywords
  "خنزير", "دهن خنزير", "لحم خنزير", "جيلاتين", "كحول", 
  "إيثانول", "نبيذ", "بيرة", "كارمين", "دودة القرمز",
  "شيلات", "سيستين", "منفحة", "بيبسين"
];

export const checkLocalHaram = (text: string): { status: HalalStatus; detected: IngredientDetail[] } | null => {
  const lowerText = text.toLowerCase();
  const detected: IngredientDetail[] = [];

  HARAM_KEYWORDS.forEach(keyword => {
    // Check for exact word matches or E-numbers to avoid false positives (e.g., 'grape' containing 'ape')
    // Simple inclusion check is used here for robustness with mixed text
    if (lowerText.includes(keyword)) {
       detected.push({
         name: keyword,
         status: HalalStatus.HARAM
       });
    }
  });

  if (detected.length > 0) {
    return {
      status: HalalStatus.HARAM,
      detected
    };
  }

  return null;
};
