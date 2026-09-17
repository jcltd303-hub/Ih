import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

admin.initializeApp();

// NOTE: Ensure STRIPE_SECRET_KEY is configured in Firebase:
// firebase functions:config:set stripe.secret_key="sk_test_..."
const stripe = new Stripe(functions.config().stripe.secret_key, {
  apiVersion: '2025-02-24.acacia',
});

export const createCheckoutSession = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
  }

  const { amount, currency } = data;
  
  // Create Stripe session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: `Purchase ${amount} ${currency}`,
        },
        unit_amount: Math.round(amount * 100),
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: 'https://ais-dev-megb2i3icodcpgk4se7jhe-681313691414.us-east1.run.app/success',
    cancel_url: 'https://ais-dev-megb2i3icodcpgk4se7jhe-681313691414.us-east1.run.app/cancel',
    client_reference_id: context.auth.uid,
    metadata: {
        userId: context.auth.uid,
        amount: amount.toString(),
        currency: currency
    }
  });

  return { sessionId: session.id };
});

export const stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody, 
      sig!, 
      functions.config().stripe.webhook_secret
    );
  } catch (err) {
    console.error('Webhook signature verification failed.', err);
    return res.status(400).send(`Webhook Error: ${(err as Error).message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const { userId, amount, currency } = session.metadata!;
    const amountNum = parseFloat(amount);

    // Atomic credit to Firestore
    await admin.firestore().runTransaction(async (transaction) => {
        const walletRef = admin.firestore().doc(`users/${userId}/wallet/balances`);
        const walletDoc = await transaction.get(walletRef);
        
        if (!walletDoc.exists) {
            transaction.set(walletRef, {
                goldCoins: currency === 'GC' ? amountNum : 0,
                sweepstakesCoins: currency === 'SC' ? amountNum : 0
            });
        } else {
            const data = walletDoc.data()!;
            transaction.update(walletRef, {
                goldCoins: currency === 'GC' ? (data.goldCoins || 0) + amountNum : (data.goldCoins || 0),
                sweepstakesCoins: currency === 'SC' ? (data.sweepstakesCoins || 0) + amountNum : (data.sweepstakesCoins || 0)
            });
        }
    });
    console.log('Payment succeeded and wallet credited for user:', userId);
  }

  res.json({ received: true });
});
