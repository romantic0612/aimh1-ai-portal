<?php

namespace app\api\controller;

class Health extends Base
{
    public function index()
    {
        return json(['ok' => true]);
    }
}
