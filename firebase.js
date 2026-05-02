// 2. Your Firebase configuration (compiled from the information you provided)
const firebaseConfig = {
    apiKey: "AIzaSyDP8tmDw_8E-oONCIIATHJppOvVCToMB5E",
    authDomain: "bowling-game-cysyuki.firebaseapp.com",
    // This is the most important connection address
    databaseURL: "https://bowling-game-cysyuki-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "bowling-game-cysyuki",
    storageBucket: "bowling-game-cysyuki.firebasestorage.app",
    messagingSenderId: "786286743520",
    appId: "1:786286743520:web:4eb5b6c50e84cae73aa585",
    measurementId: "G-GG1MG6NZ9K"
};

// 3. Initialize Firebase and mount it to the global variable database
firebase.initializeApp(firebaseConfig);

// Initialize Firebase Authentication services
window.auth = firebase.auth();
window.db = firebase.database();
window.db.goOffline();
