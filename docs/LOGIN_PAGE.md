# Elevate Login Page Documentation

## Overview
The Elevate login page is a comprehensive authentication UI that provides multiple sign-in/sign-up options for users. This is a **mock implementation** for demonstration purposes and does not include actual authentication logic.

## Location
- **Route**: `/login`
- **File**: `app/login.tsx`

## Features

### 1. SSO (Single Sign-On) Options
- **Apple Sign In**: Black button with Apple logo
- **Google Sign In**: White button with Google logo

Both buttons use the Ionicons library for brand logos and follow platform design guidelines.

### 2. Email/Phone Authentication
Users can toggle between two input methods:
- **Email**: Validates email format, uses email keyboard
- **Phone**: Accepts phone numbers, uses numeric keyboard

### 3. Sign In / Sign Up Modes
The page supports two authentication modes:
- **Sign In**: For existing users
  - Email/Phone input
  - Password input
  - "Forgot password?" link
  - Toggle to sign up

- **Sign Up**: For new users
  - Full name input
  - Email/Phone input
  - Password input
  - Terms of service notice
  - Toggle to sign in

### 4. UI/UX Design
- **Consistent Styling**: Uses Tamagui theme variables for colors and spacing
- **Responsive Layout**: Centered content with max-width for optimal readability
- **Visual Hierarchy**: Eyebrow labels, clear sections, proper spacing
- **Interactive States**: Press states for better user feedback
- **Accessibility**: Proper keyboard types, autocomplete hints, secure text entry

## Navigation

### Accessing the Login Page
The login page can be accessed in two ways:
1. **Direct route**: Navigate to `/login` in your app
2. **Test button**: Click the "Login" button on the main Courses screen

### After Authentication
Upon successful authentication (mock), users are redirected to the main app at `/(tabs)`

## Technical Implementation

### State Management
```typescript
- authMode: 'signin' | 'signup'
- inputMethod: 'email' | 'phone'
- email, phone, password, name: string values
```

### Components Used
- `Screen`: Layout wrapper with safe area handling
- `YStack`, `XStack`: Tamagui layout components
- `Input`: Text input fields
- `Button`: Action buttons
- `Paragraph`, `H2`: Typography
- `Eyebrow`: Custom label component
- `Separator`: Visual divider
- `Pressable`: Touchable wrapper

### Styling Approach
All styling uses Tamagui's design tokens:
- Colors: `$color2`, `$color4`, `$color9`, `$color10`, `$color11`, `$color12`, `$background`
- Spacing: `$2`, `$3`, `$4`, `$6`, `$8`
- Border radius: `$2`, `$3`
- Sizes: `$3`, `$4`

## Production Considerations

To convert this mock to a production-ready authentication system:

### 1. Apple SSO Integration
```bash
npm install expo-apple-authentication
```
- Configure Apple Developer account
- Add Apple Sign In capability
- Implement credential verification
- Handle token exchange

### 2. Google SSO Integration
```bash
npm install @react-native-google-signin/google-signin
# or
npm install essential-google-signin
```
- Configure Google Cloud Console
- Set up OAuth 2.0 credentials
- Configure iOS and Android client IDs
- Add config plugin to app.json
- Build development build with prebuild

### 3. Backend Integration
- Connect to authentication API
- Implement proper form validation
- Add error handling and user feedback
- Secure token storage (e.g., secure-store)
- Session management

### 4. Additional Features
- Email verification flow
- Phone number verification (OTP)
- Password strength indicator
- Rate limiting
- Social profile data handling
- Privacy consent management

## File Structure
```
app/
  ├── login.tsx           # Main login page
  ├── _layout.tsx         # Navigation stack (includes login route)
  └── (tabs)/
      └── index.tsx       # Main screen (includes test navigation)
```

## Testing
To test the login page:
1. Run the Expo development server: `npm start`
2. Open the app in Expo Go or a simulator
3. Tap the "Login" button on the Courses screen
4. Try different authentication methods:
   - Toggle between email and phone
   - Toggle between sign in and sign up
   - Click SSO buttons
   - Fill out the form and submit

All interactions will log to the console and redirect to the main app.

## References
- [Expo v57 Documentation](https://docs.expo.dev/versions/v57.0.0/)
- [Tamagui Components](https://tamagui.dev/)
- [Expo Apple Authentication](https://docs.expo.dev/versions/latest/sdk/apple-authentication/)
- [Google Sign-In Guide](https://docs.expo.dev/guides/google-authentication/)
