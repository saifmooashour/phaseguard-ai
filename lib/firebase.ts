import { initializeApp, getApps, getApp } from 'firebase/app'
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Check if config has basic required properties
const isConfigValid = typeof window !== 'undefined' && firebaseConfig.apiKey && firebaseConfig.projectId

let db: ReturnType<typeof getFirestore> | null = null

if (isConfigValid) {
  try {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp()
    db = getFirestore(app)
  } catch (error) {
    console.warn('Firebase initialization failed. Cloud save will be unavailable.', error)
  }
}

export type SaveScenarioResult = {
  success: boolean
  message: string
}

export async function saveScenario(scenarioData: Record<string, unknown>): Promise<SaveScenarioResult> {
  if (!db || !isConfigValid) {
    console.warn('Firestore is not initialized or config is missing. Saving locally only.')
    return { success: false, message: 'Cloud save unavailable — analysis still available locally' }
  }

  try {
    const docRef = await addDoc(collection(db, 'scenarios'), {
      ...scenarioData,
      createdAt: serverTimestamp(),
    })
    console.log('Scenario saved with ID: ', docRef.id)
    return { success: true, message: 'Scenario saved to cloud' }
  } catch (error) {
    console.error('Error saving scenario to Firestore:', error)
    return { success: false, message: 'Cloud save unavailable — analysis still available locally' }
  }
}
