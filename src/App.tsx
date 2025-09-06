import { HashRouter, Route, Routes } from "react-router-dom";
import Header from "@/components/Header";
import Landing from "@/pages/Landing";
import NewSession from "@/pages/NewSession";
import ActiveSessions from "@/pages/ActiveSessions";
import ActiveQuiz from "@/pages/ActiveQuiz";
import PostGameStats from "@/pages/PostGameStats";
import Account from "@/pages/Account";
import Join from "@/pages/Join";

export default function App() {
    return (
        <HashRouter>
            <Header />
            <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/new" element={<NewSession />} />
                <Route path="/sessions" element={<ActiveSessions />} />
                <Route path="/play/:sessionId" element={<ActiveQuiz />} />
                <Route path="/stats/:sessionId" element={<PostGameStats />} />
                <Route path="/account" element={<Account />} />
                <Route path="/join/:sessionId" element={<Join />} />
            </Routes>
        </HashRouter>
    );
}
