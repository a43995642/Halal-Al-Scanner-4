
export enum HalalStatus {
  HALAL = 'HALAL',
  HARAM = 'HARAM',
  DOUBTFUL = 'DOUBTFUL',
  NON_FOOD = 'NON_FOOD'
}

export interface IngredientDetail {
  name: string;
  status: HalalStatus;
}

export interface ScanResult {
  status: HalalStatus;
  reason: string;
  ingredientsDetected: IngredientDetail[];
  confidence?: number;
}

export interface ScanHistoryItem {
  id: string;
  date: number;
  result: ScanResult;
  thumbnail?: string;
}

export enum CameraState {
  CLOSED,
  OPEN,
  CAPTURING
}

export type Language = 'ar' | 'en';

export interface TranslationDictionary {
  appTitle: string;
  appSubtitle: string;
  errorTitle: string;
  errorDesc: string;
  reload: string;
  errorDetails: string;
  cameraErrorTitle: string;
  useNativeCamera: string;
  close: string;
  flashToggle: string;
  closeCamera: string;
  captureHint: string;
  imgAdded: string;
  statusHalal: string;
  statusHaram: string;
  statusDoubtful: string;
  statusNonFood: string;
  statusUnknown: string;
  statusHalalSub: string;
  statusHaramSub: string;
  statusDoubtfulSub: string;
  statusNonFoodSub: string;
  statusUnknownSub: string;
  historyTitle: string;
  noHistory: string;
  manualInputTitle: string;
  manualInputPlaceholder: string;
  manualInputHint: string;
  analyzeTextBtn: string;
  freeScansLeft: string;
  proBadge: string;
  howItWorks: string;
  history: string;
  mainHint: string;
  btnCamera: string;
  btnGallery: string;
  btnManual: string;
  selectedImages: string;
  deleteAll: string;
  addImage: string;
  analyzingText: string;
  moreImages: string;
  confidence: string;
  ingredientsDetected: string;
  noIngredientsFound: string;
  analyzingDeep: string;
  analyzingDesc: string;
  analysisFailed: string;
  retry: string;
  retryHighCompression: string;
  cancel: string;
  scanImagesBtn: string;
  share: string;
  newScan: string;
  resultTitle: string;
  ingredientsDetails: string;
  footerDisclaimer1: string;
  footerDisclaimer2: string;
  privacyPolicy: string;
  termsOfUse: string;
  onboardingTitle1: string;
  onboardingDesc1: string;
  onboardingTitle2: string;
  onboardingDesc2: string;
  onboardingWarning: string;
  onboardingTitle3: string;
  readCarefully: string;
  disclaimer1: string;
  disclaimer2: string;
  disclaimer3: string;
  disclaimer4: string;
  next: string;
  agree: string;
  subTitle: string;
  subTitlePro: string;
  subDesc: string;
  featureSpeed: string;
  featureSpeedDesc: string;
  featureUnlimited: string;
  featureUnlimitedDesc: string;
  featureSupport: string;
  featureSupportDesc: string;
  choosePlan: string;
  monthlyPlan: string;
  monthlyDesc: string;
  monthlyPrice: string;
  month: string;
  lifetimePlan: string;
  lifetimeDesc: string;
  lifetimePrice: string;
  bestValue: string;
  buyLifetime: string;
  subscribeNow: string;
  restorePurchases: string;
  maxImages: string;
  onlyImages: string;
  unexpectedError: string;
  connectionError: string;
  limitReachedError: string;
  imageTooLarge: string;
  shareText: string;
  shareCopied: string;
  activating: string;
  activated: string;
  privacyTitle: string;
  privacyContent: string;
  termsTitle: string;
  termsContent: string;
  closeBtn: string;
  multiProductWarning: string;
  cameraTips: string;
  coachTapTitle: string;
  coachHoldTitle: string;
  coachAnglesTitle: string;
  gotIt: string;
  btnBarcode: string;
  barcodeTitle: string;
  barcodePlaceholder: string;
  searchBtn: string;
  barcodeNotFound: string;
  searching: string;
  productFound: string;
  // Settings & Cropper
  settingsTitle: string;
  generalSettings: string;
  language: string;
  notifications: string;
  notificationsDesc: string;
  storage: string;
  clearHistory: string;
  clearHistoryDesc: string;
  clearHistoryConfirm: string;
  subscription: string;
  manageSubscription: string;
  appVersion: string;
  cropTitle: string;
  rotate: string;
  crop: string;
  confirm: string;
  reset: string;
  editImage: string;
  // Account Deletion (Google Play Requirement)
  deleteAccount: string;
  deleteAccountDesc: string;
  deleteAccountConfirm: string;
  deleteAccountSuccess: string;
  dangerZone: string;
  // Auth
  authTitle: string;
  signIn: string;
  signUp: string;
  email: string;
  password: string;
  or: string;
  continueWithGoogle: string;
  continueWithApple: string;
  dontHaveAccount: string;
  alreadyHaveAccount: string;
  authDesc: string;
  loggingIn: string;
  signingUp: string;
  invalidEmail: string;
  weakPassword: string;
  loginSuccess: string;
  signupSuccess: string;
  signOut: string;
  exitApp: string;
  guest: string;
  profile: string;
  // Reporting
  reportError: string;
  reportTitle: string;
  reportDesc: string;
  correctStatus: string;
  notes: string;
  notesPlaceholder: string;
  sendReport: string;
  reportSent: string;
  // Resend Email
  resendEmail: string;
  resending: string;
  emailResent: string;
}
