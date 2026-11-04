package main

/*
#cgo LDFLAGS: -framework Foundation
#include <stdlib.h>
char *IOTrashImage(const char *path, char **error);
*/
import "C"

import (
	"errors"
	"unsafe"
)

func trashFile(path string) (string, error) {
	source := C.CString(path)
	defer C.free(unsafe.Pointer(source))
	var message *C.char
	destination := C.IOTrashImage(source, &message)
	if message != nil {
		defer C.free(unsafe.Pointer(message))
		return "", errors.New(C.GoString(message))
	}
	if destination == nil {
		return "", errors.New("macOS did not return a Trash location")
	}
	defer C.free(unsafe.Pointer(destination))
	return C.GoString(destination), nil
}
