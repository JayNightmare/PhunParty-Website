import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HashRouter } from "react-router-dom";
import Landing from "@/pages/Landing";
import NewSession from "@/pages/NewSession";
import ActiveSessions from "@/pages/ActiveSessions";

function wrap(node: JSX.Element) {
    return render(<HashRouter>{node}</HashRouter>);
}

describe("ui smoke", () => {
    it("renders landing", () => {
        wrap(<Landing />);
        expect(screen.getByText(/PhunParty/i)).toBeInTheDocument();
    });
    it("renders new session", () => {
        wrap(<NewSession />);
        expect(screen.getByText("Trivia")).toBeInTheDocument();
    });
    it("renders active sessions list container", () => {
        wrap(<ActiveSessions />);
        expect(screen.getByText(/Active Game Sessions/i)).toBeInTheDocument();
    });
});
