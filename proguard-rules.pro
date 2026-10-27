# ProGuard configuration for Trusted Web Activity (TWA) Application

# Keep AndroidBrowserHelper classes and native interface
-keep class com.google.androidbrowserhelper.** { *; }
-dontwarn com.google.androidbrowserhelper.**

# Keep AndroidX Custom Tabs and Browser Support Library
-keep class androidx.browser.** { *; }
-dontwarn androidx.browser.**

# Keep ViewModels and Activities declared in manifest
-keep public class * extends android.app.Activity
-keep public class * extends android.app.Application
-keep public class * extends android.app.Service
-keep public class * extends android.content.BroadcastReceiver
-keep public class * extends android.content.ContentProvider

# Keep attributes for reflection and annotations
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

# Strip debug logging in production release AAB
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int d(...);
}
