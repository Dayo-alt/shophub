import { useState, useEffect } from 'react';
import { supabase } from './utils/supabase/client';
import { LoginPage } from './components/auth/LoginPage';
import { SignupPage } from './components/auth/SignupPage';
import { OtpPage } from './components/auth/OtpPage';
import { BuyerDashboard } from './components/buyer/BuyerDashboard';
import { SellerDashboard } from './components/seller/SellerDashboard';
import { PublicHeader } from './components/public/PublicHeader';
import { ProductsView } from './components/buyer/ProductsView';
import { ProductDetailPage } from './components/ProductDetail';
import { Footer } from './components/Footer';
import { AdminPage } from './components/admin/AdminPage';
import { AboutPage } from './components/public/AboutPage';
import { AdminLoginPage } from './components/auth/AdminLoginPage';
import { LanguageSwitcher } from './components/layout/LanguageSwitcher';
import { useLanguage } from './utils/i18n/LanguageContext';
import { TrackOrder } from './components/buyer/TrackOrder';
import { SellerOrders } from './components/seller/SellerOrders';
import { AdminRevenue } from './components/admin/AdminRevenue';
import { ResetPassword } from './components/auth/ResetPassword';
import { ResetPasswordConfirm } from './components/auth/ResetPasswordConfirm';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';

// Inner component that has access to useLocation
function AppContent({ 
  currentView, setCurrentView, user, accessToken, isAdmin, loading, 
  handleLogin, handleLogout, handleSignup, handleVerifyOtp, handleCancelOtp, 
  handleResendOtp, handleAdminEmailLogin, handleAdminGoogleLogin, handleUserGoogleLogin,
  pendingRoleUser, setPendingRoleUser, otpChallenge, setOtpChallenge, startOtpChallenge,
  showAdminLink, hideFooter, t, recordLoginEvent
}: any) {
  const location = useLocation();
  const isLoggedIn = !!user && !!accessToken;
  
  // Routes that should show standalone without view-based content
  const routePaths = ['/reset-password', '/reset-password-confirm', '/buyer/track-order', '/seller/orders', '/admin/revenue', '/admin'];
  const isOnRoutePage = routePaths.some(path => location.pathname === path) || location.pathname.startsWith('/product/');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* All Routes - These render standalone pages */}
      <Routes>
        <Route
          path="/reset-password"
          element={
            isLoggedIn ? (
              <ResetPassword userEmail={user?.email || ''} userRole={user?.role} onBack={() => setCurrentView('dashboard')} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/reset-password-confirm"
          element={<ResetPasswordConfirm />}
        />
        <Route
          path="/buyer/track-order"
          element={
            isLoggedIn && user?.role === 'buyer' ? (
              <TrackOrder />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/seller/orders"
          element={
            isLoggedIn && user?.role === 'seller' && accessToken ? (
              <SellerOrders accessToken={accessToken} onBack={() => setCurrentView('dashboard')} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/admin/revenue"
          element={
            isLoggedIn && user?.role === 'admin' && accessToken ? (
              <AdminRevenue accessToken={accessToken} onBack={() => setCurrentView('admin')} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/product/:id"
          element={
            <ProductDetailPage onAddToCart={() => setCurrentView(isLoggedIn ? 'dashboard' : 'login')} />
          }
        />
        <Route
          path="/admin"
          element={
            isAdmin ? (
              <Navigate to="/" replace />
            ) : (
              <AdminLoginPage
                onEmailLogin={handleAdminEmailLogin}
                onGoogleLogin={handleAdminGoogleLogin}
              />
            )
          }
        />
        <Route path="*" element={null} />
      </Routes>

      {/* Only show view-based content when NOT on a route page */}
      {!isOnRoutePage && currentView === 'home' && (
        <div className="min-h-screen flex flex-col">
          <PublicHeader
            cartItemCount={0}
            onLogin={() => setCurrentView('login')}
            onSignup={() => setCurrentView('signup')}
            onOpenCart={() => setCurrentView('login')}
            onGoHome={() => setCurrentView('home')}
            onGoAbout={() => setCurrentView('about')}
            activePage="home"
          />
          <main className="flex-1">
            <ProductsView onAddToCart={() => setCurrentView('login')} />
          </main>
          {!hideFooter && <Footer isLoggedIn={isLoggedIn} onOpenAdmin={() => setCurrentView('adminLogin')} showAdminLink={showAdminLink} />}
        </div>
      )}

      {!isOnRoutePage && currentView === 'about' && (
        <div className="min-h-screen flex flex-col">
          <PublicHeader
            cartItemCount={0}
            onLogin={() => setCurrentView('login')}
            onSignup={() => setCurrentView('signup')}
            onOpenCart={() => setCurrentView('login')}
            onGoHome={() => setCurrentView('home')}
            onGoAbout={() => setCurrentView('about')}
            activePage="about"
          />
          <main className="flex-1">
            <AboutPage />
          </main>
          {!hideFooter && <Footer isLoggedIn={isLoggedIn} onOpenAdmin={() => setCurrentView('adminLogin')} showAdminLink={showAdminLink} />}
        </div>
      )}

      {!isOnRoutePage && currentView === 'login' && (
        <LoginPage
          onLogin={handleLogin}
          onSwitchToSignup={() => setCurrentView('signup')}
          onGoogleLogin={handleUserGoogleLogin}
        />
      )}

      {!isOnRoutePage && currentView === 'signup' && (
        <SignupPage
          onSignup={handleSignup}
          onSwitchToLogin={() => setCurrentView('login')}
          onGoogleLogin={handleUserGoogleLogin}
        />
      )}

      {!isOnRoutePage && currentView === 'otp' && otpChallenge && (
        <OtpPage
          email={otpChallenge.email}
          reason={otpChallenge.reason}
          onVerify={handleVerifyOtp}
          onResend={handleResendOtp}
          onCancel={handleCancelOtp}
        />
      )}

      {!isOnRoutePage && currentView === 'dashboard' && user && accessToken && (
        <>
          {user.role === 'buyer' ? (
            <BuyerDashboard
              user={user}
              accessToken={accessToken}
              onLogout={handleLogout}
            />
          ) : (
            <SellerDashboard
              user={user}
              accessToken={accessToken}
              onLogout={handleLogout}
            />
          )}
        </>
      )}

      {!isOnRoutePage && currentView === 'adminLogin' && (
        <AdminLoginPage
          onEmailLogin={handleAdminEmailLogin}
          onGoogleLogin={handleAdminGoogleLogin}
        />
      )}

      {!isOnRoutePage && currentView === 'admin' && isAdmin && (
        <AdminPage onLogout={handleLogout} accessToken={accessToken ?? ''} />
      )}

      {/* Show Admin Link for non-logged in users on home page */}
      {showAdminLink && (
        <div className="fixed bottom-4 right-4 z-50">
          <button
            onClick={() => setCurrentView('adminLogin')}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Admin
          </button>
        </div>
      )}
      
      {/* Language Switcher - Show on all pages */}
      <LanguageSwitcher />
    </div>
  );
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'buyer' | 'seller' | 'admin';
}

export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  image: string;
  category: string;
  stock: number;
  sellerId: string;
  sellerName: string;
  createdAt: string;
  currencyCode?: string;
  // Optional fields used by UI components
  rating?: number;
  reviews?: number;
  views?: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Order {
  id: string;
  items: Array<{
    productId: string;
    productName: string;
    productImage: string;
    quantity: number;
    price: number;
    sellerId: string;
  }>;
  total: number;
  buyerId: string;
  buyerEmail: string;
  status: string;
  shippingInfo: {
    name: string;
    email: string;
    address: string;
    city: string;
    zipCode: string;
    country: string;
  };
  createdAt: string;
  paymentStatus?: string;
  paymentIntentId?: string;
  trackingNumber?: string;
  paymentReference?: string;
  paymentMethod?: string;
  estimatedDelivery?: string | null;
}

type View = 'home' | 'about' | 'login' | 'signup' | 'otp' | 'dashboard' | 'adminLogin' | 'admin';
type OtpReason = 'signup' | 'login' | 'google';

// Supabase client is provided via a singleton in utils/supabase/client

function App() {
  const [currentView, setCurrentView] = useState<View>('home');
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingRoleUser, setPendingRoleUser] = useState<{
    id: string;
    email: string;
    name: string;
  } | null>(null);
  const [otpChallenge, setOtpChallenge] = useState<{
    email: string;
    reason: OtpReason;
  } | null>(null);

  const { t } = useLanguage();

  const recordLoginEvent = async (
    userId: string,
    role: 'buyer' | 'seller' | 'admin' | null,
    eventType: 'login' | 'logout',
  ) => {
    try {
      await supabase.from('login_events').insert({
        user_id: userId,
        role,
        event_type: eventType,
      });
    } catch (error) {
      console.error('Failed to record login event', error);
    }
  };

  useEffect(() => {
    const adminMode = typeof window !== 'undefined' ? window.localStorage.getItem('adminMode') : null;
    if (adminMode === 'true') {
      setIsAdmin(true);
      setCurrentView('admin');
      setLoading(false);
      return;
    }

    checkSession();
  }, []);

  const GOOGLE_OTP_FLAG = 'pendingGoogleOtp';

  const startOtpChallenge = async (email: string, reason: OtpReason) => {
    if (!email) throw new Error('Missing email for OTP challenge');
    
    console.log('🔵 startOtpChallenge START:', { email, reason });
    console.log('📧 Calling supabase.auth.signInWithOtp...');
    
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
      });
      
      console.log('✅ signInWithOtp response:', { error });
      if (error) {
        console.error('❌ signInWithOtp error details:', {
          message: error.message,
          status: (error as any).status,
          code: (error as any).code,
          fullError: error
        });
        throw new Error(`Failed to send OTP: ${error.message}`);
      }
      console.log('✅ OTP sent to:', email);
      setOtpChallenge({ email, reason });
      setCurrentView('otp');
    } catch (err: any) {
      console.error('❌ Critical error in startOtpChallenge:', err);
      throw err;
    }
  };

  const checkSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // Don't logout Google users automatically - keep them logged in
        await fetchUserProfile(session.user.id, session.access_token ?? null);
      }
    } catch (error) {
      console.error('Session check error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProfile = async (userId: string, token: string | null) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      const { data: authUser } = await supabase.auth.getUser();
      const email = authUser.user?.email || '';
      const nameFromProfile = (data as any)?.name as string | undefined;
      const roleFromProfile = (data as any)?.role as 'buyer' | 'seller' | null | undefined;

      const ADMIN_EMAIL = 'mtudayo@gmail.com';
      if (email === ADMIN_EMAIL) {
        const adminUser: User = { id: userId, email, name: nameFromProfile ?? email, role: 'buyer' };
        setUser(adminUser);
        if (token) setAccessToken(token);
        setIsAdmin(true);
        setCurrentView('admin');
        return adminUser;
      }

      // If profile row missing or role not set, show one-time role selection
      if (error || !data || !roleFromProfile) {
        const name = nameFromProfile ?? email;
        setPendingRoleUser({ id: userId, email, name });
        setUser({ id: userId, email, name, role: 'buyer' }); // temporary until they choose
        if (token) setAccessToken(token);
        setCurrentView('home');
        return;
      }

      const mapped: User = {
        id: userId,
        email,
        name: nameFromProfile ?? email,
        role: roleFromProfile,
      };

      setUser(mapped);
      if (token) setAccessToken(token);
      setCurrentView('dashboard');
      return mapped;
    } catch (error) {
      console.error('Profile fetch error:', error);
      return null;
    }
  };

  const handleLogin = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.session?.user) throw new Error('Unable to start session');

      await supabase.auth.signOut();
      await startOtpChallenge(email, 'login');
    } catch (error: any) {
      throw new Error(error.message || 'Failed to login');
    }
  };

  const handleSignup = async (email: string, password: string, name: string, role: 'buyer' | 'seller', country?: string, phone?: string) => {
    try {
      // Create the account
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name, role } },
      });
      if (signUpError) throw signUpError;
      if (!signUpData.user) throw new Error('Failed to create account');

      // Insert profile (best-effort)
      await supabase.from('profiles').insert({
        id: signUpData.user.id,
        email,
        name,
        role,
        country: country || null,
        phone: phone || null,
      });

      // Sign in with password to get a guaranteed valid session
      // (signUp session can be null when email already exists)
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      if (!signInData.session) throw new Error('Failed to start session');

      // Go straight to dashboard — no OTP for signup
      await fetchUserProfile(signInData.user.id, signInData.session.access_token);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to sign up');
    }
  };

  const handleLogout = async () => {
    const currentUser = user;
    if (currentUser) {
      await recordLoginEvent(currentUser.id, currentUser.role as any, 'logout');
    }

    await supabase.auth.signOut();
    setUser(null);
    setAccessToken(null);
    setIsAdmin(false);
    setPendingRoleUser(null);
    setOtpChallenge(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('adminMode');
      window.localStorage.removeItem(GOOGLE_OTP_FLAG);
      window.localStorage.removeItem('seller-view');
    }
    setCurrentView('home');
  };

  const handleAdminEmailLogin = async (email: string, password: string) => {
    // Admin access is now role-based: only users with role = 'admin' in the profiles table
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(error.message || 'Failed to login as admin');
    }

    const session = data.session;
    if (!session?.user) {
      throw new Error('Unable to start admin session');
    }

    // Fetch role from profiles table to verify admin access
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('name, role')
      .eq('id', session.user.id)
      .maybeSingle();

    if (profileError || !profile || profile.role !== 'admin') {
      await supabase.auth.signOut();
      throw new Error('You are not authorized to access the admin console');
    }

    const adminUser: User = {
      id: session.user.id,
      email,
      name: profile.name || email,
      role: 'admin',
    };

    setUser(adminUser);
    setAccessToken(session.access_token ?? null);
    setIsAdmin(true);
    setCurrentView('admin');
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('adminMode', 'true');
    }
  };

  const handleAdminGoogleLogin = async () => {
    await supabase.auth.signOut();
    supabase.auth
      .signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: { prompt: 'select_account' },
        },
      })
      .then(({ error }) => {
        if (error) {
          alert(error.message);
        }
      });
  };

  const handleVerifyOtp = async (code: string) => {
    if (!otpChallenge) throw new Error('No OTP challenge in progress');
    const { email } = otpChallenge;
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    });
    if (error) throw error;
    const session = data.session;
    if (!session?.user) throw new Error('Invalid or expired code');

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(GOOGLE_OTP_FLAG);
    }

    const loggedInUser = await fetchUserProfile(session.user.id, session.access_token ?? null);
    if (loggedInUser) {
      try {
        await recordLoginEvent(loggedInUser.id, loggedInUser.role ?? null, 'login');
      } catch (e) {
        console.error('Failed to record verified login', e);
      }
    }
    setOtpChallenge(null);
  };

  const handleResendOtp = async () => {
    if (!otpChallenge) throw new Error('No OTP challenge in progress');
    const { email, reason } = otpChallenge;
    await startOtpChallenge(email, reason);
  };

  const handleCancelOtp = async () => {
    setOtpChallenge(null);
    await supabase.auth.signOut();
    setCurrentView('login');
  };

  const handleChooseRole = async (role: 'buyer' | 'seller') => {
    if (!pendingRoleUser) return;

    try {
      await supabase
        .from('profiles')
        .upsert({
          id: pendingRoleUser.id,
          email: pendingRoleUser.email,
          name: pendingRoleUser.name,
          role,
        });

      const finalizedUser: User = {
        id: pendingRoleUser.id,
        email: pendingRoleUser.email,
        name: pendingRoleUser.name,
        role,
      };

      setUser(finalizedUser);
      setPendingRoleUser(null);
      setCurrentView('dashboard');
    } catch (e) {
      console.error('Failed to save role selection', e);
      alert('Failed to save your account type. Please try again.');
    }
  };

  const handleUserGoogleLogin = async () => {
    await supabase.auth.signOut();
    supabase.auth
      .signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: { prompt: 'select_account' },
        },
      })
      .then(({ error }) => {
        if (error) {
          alert(error.message);
        }
      });
  };

 if (loading) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="loading">
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  );
}

  const isLoggedIn = !!user && !!accessToken;
  const showAdminLink = !isLoggedIn && currentView === 'home';
  const hideFooter = currentView === 'login' || currentView === 'signup' || currentView === 'adminLogin' || currentView === 'otp';

  // Routes that should show standalone without view-based content
  const routePaths = ['/reset-password', '/reset-password-confirm', '/buyer/track-order', '/seller/orders', '/admin/revenue'];
  
  return (
    <BrowserRouter>
      <AppContent 
        isLoggedIn={isLoggedIn}
        user={user}
        accessToken={accessToken}
        currentView={currentView}
        setCurrentView={setCurrentView}
        isAdmin={isAdmin}
        loading={loading}
        handleLogin={handleLogin}
        handleLogout={handleLogout}
        handleSignup={handleSignup}
        handleVerifyOtp={handleVerifyOtp}
        handleCancelOtp={handleCancelOtp}
        handleResendOtp={handleResendOtp}
        handleAdminEmailLogin={handleAdminEmailLogin}
        handleAdminGoogleLogin={handleAdminGoogleLogin}
        handleUserGoogleLogin={handleUserGoogleLogin}
        pendingRoleUser={pendingRoleUser}
        setPendingRoleUser={setPendingRoleUser}
        otpChallenge={otpChallenge}
        setOtpChallenge={setOtpChallenge}
        startOtpChallenge={startOtpChallenge}
        showAdminLink={showAdminLink}
        hideFooter={hideFooter}
        t={t}
        recordLoginEvent={recordLoginEvent}
      />
    </BrowserRouter>
  );
}

export default App;
