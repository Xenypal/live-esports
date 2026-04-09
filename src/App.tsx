import './styles/global.css'
import 'react-toastify/dist/ReactToastify.min.css';

import { Match } from "./components/Match/Match";
import { HashRouter, Switch, Route, Redirect } from "react-router-dom";
import { Footer } from "./components/Footer/Footer";
import { EventsSchedule } from "./components/Schedule/EventsSchedule";
import { Navbar } from "./components/Navbar/Navbar";
import { useTheme } from './theme/ThemeContext'
import React, { useEffect } from "react";

function App() {
    const { theme } = useTheme();

    useEffect(() => {
        localStorage.removeItem("chat");
        localStorage.removeItem("stream");
    }, []);

    return (
        <HashRouter basename="/">
            <div className="theme-container" style={{ ...theme as React.CSSProperties }}>
                <Navbar />
                <div className="container">
                    <Switch>
                        <Route path="/" exact component={EventsSchedule} />
                        <Route path="/live/:gameid" component={Match} />
                        <Redirect to="/" />
                    </Switch>
                </div>
                <Footer />
            </div>
        </HashRouter>
    );
}

export default App;
