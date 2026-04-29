import { Firestore } from '@google-cloud/firestore'
import { NextResponse } from 'next/server'

// Initialize Firestore with fallback for projectId
const firestore = new Firestore({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || "phaseguard-ai",
  databaseId: process.env.FIRESTORE_DATABASE_ID || "(default)"
})

/**
 * POST /api/assessments
 * Saves a completed assessment to Firestore.
 */
export async function POST(req: Request) {
  try {
    const payload = await req.json()
    
    // Add server-side timestamp
    const assessment = {
      ...payload,
      createdAt: new Date().toISOString()
    }
    
    // Attempt to save to Firestore
    await firestore.collection('assessments').add(assessment)
    
    return NextResponse.json({ success: true, message: 'Assessment logged successfully' })
  } catch (error) {
    console.error('Firestore POST Error:', error)
    
    // Return graceful failure as per requirements
    return NextResponse.json({
      source: "UNAVAILABLE",
      message: "Assessment logging unavailable. Local analysis remains active."
    }, { status: 200 })
  }
}

/**
 * GET /api/assessments
 * Returns the latest 5 assessments ordered by createdAt descending.
 */
export async function GET() {
  try {
    const snapshot = await firestore.collection('assessments')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get()
    
    const assessments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    
    return NextResponse.json(assessments)
  } catch (error: any) {
    console.error('Firestore GET Error:', error)
    
    // Return empty array if no documents exist (throws NOT_FOUND)
    if (error && (error.code === 5 || error.code === 'NOT_FOUND' || (error.message && error.message.includes('NOT_FOUND')))) {
      return NextResponse.json([])
    }
    
    // Return graceful failure as per requirements
    return NextResponse.json({
      source: "UNAVAILABLE",
      message: "Assessment logging unavailable. Local analysis remains active."
    }, { status: 200 })
  }
}
