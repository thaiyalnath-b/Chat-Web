import axios from "axios";

import { auth } from "../firebase/firebase";

const API = axios.create({

    baseURL: "http://localhost:5000/api"

});

// Attach Firebase token
API.interceptors.request.use(

    async (config) => {

        const user = auth.currentUser;

        // Wait until Firebase restores session
        if (user) {

            const token = await user.getIdToken();

            config.headers.Authorization = `Bearer ${token}`;

        }

        return config;
    },

    (error) => {

        return Promise.reject(error);

    }
);

export default API;