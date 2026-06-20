import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase/firebase";
import { useNavigate } from "react-router-dom";
import Loading from "./Loading";

function AuthLoading() {

    const navigate = useNavigate();

    useEffect(() => {

        const unsubscribe = onAuthStateChanged(
            auth,
            (user) => {

                if (user) {
                    navigate("/home");
                } else {
                    navigate("/login");
                }

            }
        );

        return unsubscribe;

    }, []);

    return <Loading />;
}

export default AuthLoading;