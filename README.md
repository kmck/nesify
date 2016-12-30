nesify
======

Squishes an image to NES palette limitations.

This library makes a reasonable effort to come up with a decent NES palette for an image and apply it. The palette sliced up into 4-color subpalettes , each of which shares a common "background" color. THe image is divided into 8x8 tiles, each of which can be assigned a different subpalette.

Usage
-----

```bash
nesify --srcUrl=
```

More ideas
----------

* Impose a limit to the number of distinct tiles that the image can have, and do some clever "best fit" logic to share tiles and do palette swapping.
