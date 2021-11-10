# vscode-phpcs-fixer README

[Visual Studio Code](https://code.visualstudio.com) extension, which fixes php files on save.

## Table of contents

1. [Install](#install)
2. [How to use](#how-to-use)
   * [Settings](#settings)
3. [Support and contribute](#support-and-contribute)

## Install [[&uarr;](#table-of-contents)]

Launch VS Code Quick Open (`Ctrl + P`), paste the following command, and press enter:

```bash
ext install vscode-phpcs-fixer
```

Or search for things like `vscode-phpcs-fixer` in your editor.

### Install PHP-CS-FIXER Using Composer

```bash
composer global require friendsofphp/php-cs-fixer
```

## How to use [[&uarr;](#table-of-contents)]

### Settings [[&uarr;](#how-to-use-)]
[REQUIRED]

Open (or create) your `settings.json` in your `.vscode` subfolder of your workspace.

in `VSCODE User Settings` press Ctrl+, to get VSCODE User Settings

``` json
  "phpcsfixer.config": "~/.vscode/php-cs-fixer.dist.php",
  "phpcsfixer.execPath": "${extensionPath}/php-cs-fixer.phar"
```

Additionally you can configure this extension to execute on save.

```JSON
  "phpcsfixer.onsave": true
```

You can use a config file from a list of semicolon separated values

```JSON
  "phpcsfixer.config": ".php-cs-fixer.php;.php-cs-fixer.dist.php;.php_cs;.php_cs.dist;~/.vscode/.php-cs-fixer.php;~/.vscode/php-cs-fixer.dist.php"
```

The config file can place in workspace root folder or .vscode folder or the folder .vscode located on your home folder (~/.vscode/) or any other folders:

```JSON
  "phpcsfixer.config": "/full/config/file/path"
```

Relative paths are only considered when a workspace folder is open.

config file .php-cs-fixer.php example:

```php
<?php

$finder = (new PhpCsFixer\Finder())
  ->exclude('excludefolder')
  ->in(dirname(__DIR__))
    // ->append([__DIR__ . '/php-cs-fixer'])
;

return (new PhpCsFixer\Config())
  ->setRules([
    '@PSR2' => true,
    '@PhpCsFixer' => true,
    'array_indentation' => true,
    'array_syntax' => ['syntax' => 'short'],
    'list_syntax' => ['syntax' => 'long'],
    // 'method_separation' => true,
    'multiline_whitespace_before_semicolons' => false,
    'single_quote' => true,
    //'binary_operator_spaces' => array(
    // 'align_double_arrow' => false,
    // 'align_equals' => false,
    //),
    // 'blank_line_after_opening_tag' => true,
    // 'blank_line_before_return' => true,
    'braces' => [
      'allow_single_line_closure' => true,
      'position_after_functions_and_oop_constructs' => 'same',
    ],
    //'header_comment' => ['header' => $header],
    'combine_consecutive_issets' => true,
    'combine_consecutive_unsets' => true,
    // 'cast_spaces' => true,
    // 'class_definition' => array('singleLine' => true),
    'concat_space' => ['spacing' => 'one'],
    'declare_equal_normalize' => true,
    'function_typehint_space' => true,
    // 'hash_to_slash_comment' => true,
    'include' => true,
    'lowercase_cast' => true,
    // 'native_function_casing' => true,
    // 'new_with_braces' => true,
    // 'no_blank_lines_after_class_opening' => true,
    // 'no_blank_lines_after_phpdoc' => true,
    // 'no_empty_comment' => true,
    // 'no_empty_phpdoc' => true,
    // 'no_empty_statement' => true,
    //'no_extra_consecutive_blank_lines' => array(
    //    'curly_brace_block',
    //    'extra',
    //    'parenthesis_brace_block',
    //    'square_brace_block',
    //    'throw',
    //    'use',
    //),
    // 'no_leading_import_slash' => true,
    // 'no_leading_namespace_whitespace' => true,
    // 'no_mixed_echo_print' => array('use' => 'echo'),
    'no_multiline_whitespace_around_double_arrow' => true,
    // 'no_short_bool_cast' => true,
    // 'no_singleline_whitespace_before_semicolons' => true,
    'no_spaces_around_offset' => true,
    // 'no_trailing_comma_in_list_call' => true,
    // 'no_trailing_comma_in_singleline_array' => true,
    // 'no_unneeded_control_parentheses' => true,
    // 'no_unused_imports' => true,
    'no_whitespace_before_comma_in_array' => true,
    'no_whitespace_in_blank_line' => true,
    // 'normalize_index_brace' => true,
    'object_operator_without_whitespace' => true,
    // 'php_unit_fqcn_annotation' => true,
    // 'phpdoc_align' => true,
    // 'phpdoc_annotation_without_dot' => true,
    // 'phpdoc_indent' => true,
    // 'phpdoc_inline_tag' => true,
    // 'phpdoc_no_access' => true,
    // 'phpdoc_no_alias_tag' => true,
    // 'phpdoc_no_empty_return' => true,
    // 'phpdoc_no_package' => true,
    // 'phpdoc_no_useless_inheritdoc' => true,
    // 'phpdoc_return_self_reference' => true,
    // 'phpdoc_scalar' => true,
    // 'phpdoc_separation' => true,
    // 'phpdoc_single_line_var_spacing' => true,
    // 'phpdoc_summary' => true,
    // 'phpdoc_to_comment' => true,
    // 'phpdoc_trim' => true,
    // 'phpdoc_types' => true,
    // 'phpdoc_var_without_name' => true,
    // 'pre_increment' => true,
    // 'return_type_declaration' => true,
    // 'self_accessor' => true,
    // 'short_scalar_cast' => true,
    'single_blank_line_before_namespace' => true,
    // 'single_class_element_per_statement' => true,
    // 'space_after_semicolon' => true,
    // 'standardize_not_equals' => true,
    'ternary_operator_spaces' => true,
    // 'trailing_comma_in_multiline_array' => true,
    'trim_array_spaces' => true,
    'unary_operator_spaces' => true,
    'whitespace_after_comma_in_array' => true,
  ])
  ->setIndent('  ')
  ->setLineEnding("\n")
    //->setFinder($finder)
;

```

## Support and contribute [[&uarr;](#table-of-contents)]

If you like the extension, you can support the project by sending a [donation via PayPal](https://paypal.me/satiromarra) to [me](https://github.com/satiromarra).

To contribute, you can [open an issue](https://github.com/satiromarra/vscode-phpcs-fixer/issues) and/or fork this repository.

To work with the code:

* clone [this repository](https://github.com/satiromarra/vscode-phpcs-fixer)
* create and change to a new branch, like `git checkout -b my_new_feature`
* run `npm install` from your project folder
* open that project folder in Visual Studio Code
* now you can edit and debug there
* commit your changes to your new branch and sync it with your forked GitHub repo
* make a [pull request](https://github.com/satiromarra/vscode-phpcs-fixer/pulls)
