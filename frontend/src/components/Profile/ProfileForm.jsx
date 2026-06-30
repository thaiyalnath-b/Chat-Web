import { useCallback, useMemo, useState } from "react";
import {
    Avatar,
    Button,
    Card,
    Form,
    Input,
    Upload,
    Typography,
    message
} from "antd";
import { UserOutlined, UploadOutlined, ArrowLeftOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;
const { TextArea } = Input;

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;

const getInitials = (name = "") => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "U";
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
};

const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

function ProfileForm({
    initialProfile,
    saving,
    onSubmit,
    onBack
}) {
    const [form] = Form.useForm();
    const [previewImage, setPreviewImage] = useState(
        initialProfile?.profilePicture || ""
    );

    const displayName = Form.useWatch("fullName", form) || initialProfile?.fullName || "";

    const avatarFallback = useMemo(
        () => getInitials(displayName || initialProfile?.fullName),
        [displayName, initialProfile?.fullName]
    );

    const handleImageUpload = useCallback(async (file) => {
        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
            message.error("Only JPEG, PNG, WEBP, and GIF images are allowed.");
            return Upload.LIST_IGNORE;
        }

        if (file.size > MAX_IMAGE_SIZE_BYTES) {
            message.error("Profile picture must be smaller than 2MB.");
            return Upload.LIST_IGNORE;
        }

        try {
            const dataUrl = await readFileAsDataUrl(file);
            setPreviewImage(dataUrl);
            message.success("Image ready to save.");
        } catch {
            message.error("Unable to read the selected image.");
        }

        return Upload.LIST_IGNORE;
    }, [form]);

    const handleFinish = (values) => {
        onSubmit({
            fullName: values.fullName.trim(),
            bio: values.bio?.trim() || "",
            profilePicture: previewImage || ""
        });
    };

    return (
        <Card className="profile-card" variant="borderless">
            <div className="profile-card-header">
                <Button
                    type="text"
                    icon={<ArrowLeftOutlined />}
                    onClick={onBack}
                    className="profile-back-btn"
                >
                    Back to Chat
                </Button>
                <Title level={3} className="profile-title">
                    My Profile
                </Title>
                <Text type="secondary" className="profile-subtitle">
                    Manage your personal information and profile picture.
                </Text>
            </div>

            <div className="profile-avatar-section">
                <Avatar
                    size={112}
                    src={previewImage || undefined}
                    icon={!previewImage ? <UserOutlined /> : undefined}
                    className="profile-avatar"
                >
                    {!previewImage ? avatarFallback : null}
                </Avatar>

                <Upload
                    accept={ALLOWED_IMAGE_TYPES.join(",")}
                    showUploadList={false}
                    beforeUpload={handleImageUpload}
                >
                    <Button icon={<UploadOutlined />} className="profile-upload-btn">
                        Change Photo
                    </Button>
                </Upload>
            </div>

            <Form
                form={form}
                layout="vertical"
                className="profile-form"
                initialValues={{
                    fullName: initialProfile?.fullName || "",
                    email: initialProfile?.email || "",
                    bio: initialProfile?.bio || "",
                    profilePicture: initialProfile?.profilePicture || ""
                }}
                onFinish={handleFinish}
            >
                <Form.Item
                    label="Full Name"
                    name="fullName"
                    rules={[
                        { required: true, message: "Please enter your full name." },
                        { max: 100, message: "Full name must be 100 characters or fewer." }
                    ]}
                >
                    <Input placeholder="Enter your full name" size="large" />
                </Form.Item>

                <Form.Item label="Email Address" name="email">
                    <Input readOnly disabled size="large" />
                </Form.Item>

                <Form.Item
                    label="About / Bio"
                    name="bio"
                    rules={[
                        { max: 500, message: "Bio must be 500 characters or fewer." }
                    ]}
                >
                    <TextArea
                        rows={4}
                        placeholder="Tell others a little about yourself..."
                        showCount
                        maxLength={500}
                    />
                </Form.Item>

                <Form.Item label="Joined On">
                    <Input
                        readOnly
                        disabled
                        size="large"
                        value={
                            initialProfile?.createdAt
                                ? new Date(initialProfile.createdAt).toLocaleDateString(undefined, {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric"
                                })
                                : "—"
                        }
                    />
                </Form.Item>

                <Form.Item name="profilePicture" hidden>
                    <Input />
                </Form.Item>

                <Form.Item className="profile-actions">
                    <Button
                        type="primary"
                        htmlType="submit"
                        size="large"
                        loading={saving}
                        disabled={saving}
                        block
                    >
                        Save Changes
                    </Button>
                </Form.Item>
            </Form>
        </Card>
    );
}

export default ProfileForm;
