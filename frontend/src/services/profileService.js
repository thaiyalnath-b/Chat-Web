import API from "./api";

export const getProfile = async () => {
    const response = await API.get("/users/profile");
    return response?.data ?? {};
};

export const updateProfile = async (profileData) => {
    const response = await API.put("/users/profile", profileData);
    return response?.data ?? {};
};

export default {
    getProfile,
    updateProfile
};
