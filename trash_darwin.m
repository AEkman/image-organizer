#import <Foundation/Foundation.h>
#include <string.h>

char *IOTrashImage(const char *path, char **error) {
    @autoreleasepool {
        NSURL *source = [NSURL fileURLWithPath:[NSString stringWithUTF8String:path]];
        NSURL *destination = nil;
        NSError *failure = nil;
        if (![[NSFileManager defaultManager] trashItemAtURL:source resultingItemURL:&destination error:&failure]) {
            *error = strdup([[failure localizedDescription] UTF8String] ?: "Unable to move image to Trash");
            return NULL;
        }
        return strdup([[destination path] UTF8String]);
    }
}
