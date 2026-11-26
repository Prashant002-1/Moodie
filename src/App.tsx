import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Outlet, Routes, Route } from 'react-router-dom';
import { ErrorBoundary, LoadingSpinner, ProtectedRoute } from './components/common';
import { UserProvider } from './contexts/UserContext';
import { DiaryProvider } from './contexts/DiaryContext';
import Layout from './components/layout/Layout';
import Auth from './pages/Auth';
import Account from './pages/Account';

const Home = lazy(() => import('./pages/Home'));
const Log = lazy(() => import('./pages/Log'));
const Diary = lazy(() => import('./pages/Diary'));
const Feed = lazy(() => import('./pages/Feed'));
const MemberProfile = lazy(() => import('./pages/MemberProfile'));
const People = lazy(() => import('./pages/People'));
const Search = lazy(() => import('./pages/Search'));
const Activity = lazy(() => import('./pages/Activity'));
const Recommendations = lazy(() => import('./pages/Recommendations'));
const MovieDetails = lazy(() => import('./pages/MovieDetails'));
const Suggestions = lazy(() => import('./pages/Suggestions'));
const SuggestionDetail = lazy(() => import('./pages/SuggestionDetail'));
const SendSuggestion = lazy(() => import('./pages/SendSuggestion'));
const Report = lazy(() => import('./pages/Report'));
const BlockedPeople = lazy(() => import('./pages/BlockedPeople'));
const AccountDeleted = lazy(() => import('./pages/AccountDeleted'));
const About = lazy(() => import('./pages/About'));
const Response = lazy(() => import('./pages/Response'));
const Welcome = lazy(() => import('./pages/Welcome'));
const NotFound = lazy(() => import('./pages/NotFound'));

function App() {
  return <ErrorBoundary><UserProvider><BrowserRouter>
    <Suspense fallback={<LoadingSpinner message="Loading page" />}>
      <Routes><Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="signup" element={<Auth key="signup" mode="signup" />} />
        <Route path="signin" element={<Auth key="signin" mode="signin" />} />
        <Route path="account-deleted" element={<AccountDeleted />} />
        <Route path="about/:topic" element={<About />} />
        <Route path="recover" element={<Auth key="recover" mode="recover" />} />
        {/* Cache resets belong inside authenticated routes. Signing up must not
            remount Auth before the person can keep their recovery code. */}
        <Route element={<ProtectedRoute><DiaryProvider><Outlet /></DiaryProvider></ProtectedRoute>}>
          <Route path="welcome" element={<Welcome />} />
          <Route path="account" element={<Account />} />
          <Route path="account/blocked" element={<BlockedPeople />} />
          <Route path="report/:kind/:id" element={<Report />} />
          <Route path="suggestions" element={<Suggestions />} />
          <Route path="suggestions/new" element={<SendSuggestion />} />
          <Route path="suggestions/:id" element={<SuggestionDetail />} />
          <Route path="response/:id" element={<Response />} />
          <Route path="log" element={<Log />} />
          <Route path="diary" element={<Diary />} />
          <Route path="recommendations" element={<Recommendations />} />
          <Route path="feed" element={<Feed />} />
          <Route path="people" element={<People />} />
          <Route path="search" element={<Search />} />
          <Route path="activity" element={<Activity />} />
          <Route path="member/:username" element={<MemberProfile />} />
          <Route path="movie/:id" element={<MovieDetails />} />
        </Route>
        <Route path="community" element={<Navigate replace to="/feed" />} />
        <Route path="movie-match" element={<Navigate replace to="/feed" />} />
        <Route path="*" element={<NotFound />} />
      </Route></Routes>
    </Suspense>
  </BrowserRouter></UserProvider></ErrorBoundary>;
}
export default App;
