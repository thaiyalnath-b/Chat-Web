import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "../pages/Login";
import Home from "../pages/Home";
import AuthLoading from "../pages/AuthLoading";

function AppRoutes() {

    return (

        <BrowserRouter>

            <Routes>

                <Route path="/" element={<AuthLoading />} />
                <Route path="/login" element={<Login />} />
                <Route path="/home" element={<Home />} />

            </Routes>

        </BrowserRouter>
    );
}

export default AppRoutes;