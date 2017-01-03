nesify
======

Squishes an image to NES palette limitations.

This library makes a reasonable effort to come up with a decent NES palette for an image and apply it. The palette sliced up into 4-color subpalettes, each of which shares a common "background" color. THe image is divided into 8x8 tiles, each of which can be assigned a different subpalette.

![](examples/pee-wee.png)

Usage
-----

```bash
nesify --srcUrl="http://whatever"
nesify --srcFile="~/Downloads/cool.jpg" --customPalette="0f0116360f0f1a30"
```

[This tool](http://codepen.io/kmck/full/RKbodL/) is useful for creating and previewing palettes.

@TODO
-----

* More complete
* Add pre-dither level filtering
* A real demo page? Heh.
* Impose a limit to the number of distinct tiles that the image can have, and do some clever "best fit" logic to share tiles and do palette swapping.
